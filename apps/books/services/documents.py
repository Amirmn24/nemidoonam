"""
مدیریت اسناد PDF قفسه — امن و مقیاس‌پذیر.

- آپلود: Presigned S3 یا PUT خصوصی لوکال (نه multipart سنگین روی create shelf)
- دانلود: فقط بعد از AuthN/AuthZ؛ S3 با redirect به Presigned GET؛ لوکال از private root
- DB فقط متادیتا + storage_key
"""

from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.urls import reverse
from django.utils import timezone

from apps.books.models import (
    Book,
    BookStatus,
    DIGITAL_RESOURCE_KINDS,
    ResourceKind,
    SetupStepStatus,
    UserBook,
    UserBookDocument,
)
from apps.books.models.document import DocumentUploadSession
from apps.books.services import object_storage as storage

logger = logging.getLogger(__name__)

DEFAULT_PDF_MAX_BYTES = 40 * 1024 * 1024
ALLOWED_PDF_CONTENT_TYPES = frozenset(
    {
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'applications/vnd.pdf',
        'text/pdf',
        'text/x-pdf',
    }
)


def pdf_max_bytes() -> int:
    return int(getattr(settings, 'BOOKS_PDF_MAX_BYTES', DEFAULT_PDF_MAX_BYTES))


def is_digital_kind(kind: str) -> bool:
    return kind in DIGITAL_RESOURCE_KINDS


def _validate_filename_and_type(filename: str, content_type: str, size_bytes: int) -> None:
    name = (filename or '').lower()
    ctype = (content_type or '').lower()
    if size_bytes <= 0:
        raise ValidationError({'size_bytes': 'حجم فایل نامعتبر است.'})
    if size_bytes > pdf_max_bytes():
        mb = pdf_max_bytes() // (1024 * 1024)
        raise ValidationError({'size_bytes': f'حجم PDF نباید بیشتر از {mb} مگابایت باشد.'})
    if not name.endswith('.pdf') and ctype not in ALLOWED_PDF_CONTENT_TYPES:
        raise ValidationError({'filename': 'فقط فایل PDF پذیرفته می‌شود.'})
    if ctype and ctype not in ALLOWED_PDF_CONTENT_TYPES and not name.endswith('.pdf'):
        raise ValidationError({'content_type': 'نوع فایل معتبر نیست.'})


def extract_pdf_page_count(stream: BinaryIO) -> int:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover
        raise ValidationError({'pdf': 'موتور خواندن PDF در سرور نصب نیست.'}) from exc

    try:
        reader = PdfReader(stream, strict=False)
        count = len(reader.pages)
    except Exception as exc:
        logger.info('خواندن صفحات PDF ناموفق: %s', exc.__class__.__name__)
        raise ValidationError({'pdf': 'نتوانستیم تعداد صفحات PDF را بخوانیم.'}) from exc

    if count < 1:
        raise ValidationError({'pdf': 'PDF باید حداقل یک صفحه داشته باشد.'})
    return count


def page_count_from_storage_key(storage_key: str) -> int:
    handle, tmp_path = storage.open_object_for_read(storage_key)
    try:
        # تأیید امضای PDF
        head = handle.read(5)
        if not head.startswith(b'%PDF-'):
            raise ValidationError({'pdf': 'محتوای فایل PDF معتبر نیست.'})
        handle.seek(0)
        return extract_pdf_page_count(handle)
    finally:
        try:
            handle.close()
        except Exception:
            pass
        if tmp_path is not None:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except OSError:
                pass


@transaction.atomic
def create_upload_session(
    user,
    *,
    filename: str,
    content_type: str = 'application/pdf',
    size_bytes: int = 0,
    request=None,
) -> tuple[DocumentUploadSession, dict]:
    _validate_filename_and_type(filename, content_type, size_bytes or 1)

    expires = timezone.now() + timedelta(
        seconds=int(getattr(settings, 'DOCUMENTS_UPLOAD_URL_EXPIRES', 600))
    )
    target = storage.create_upload_target(
        user_id=user.pk,
        filename=filename,
        content_type=content_type or 'application/pdf',
        request=request,
    )
    session = DocumentUploadSession.objects.create(
        user=user,
        storage_key=target.storage_key,
        original_filename=(filename or '')[:255],
        content_type=(content_type or 'application/pdf')[:100],
        claimed_size_bytes=size_bytes,
        status=DocumentUploadSession.Status.PENDING,
        backend=target.backend,
        expires_at=expires,
    )

    if target.backend == 'local':
        upload_url = request.build_absolute_uri(
            reverse('api-document-upload-binary', kwargs={'token': session.token})
        ) if request else reverse(
            'api-document-upload-binary', kwargs={'token': session.token}
        )
        headers = {
            **target.headers,
            # کلاینت باید CSRF را مثل بقیهٔ API بفرستد
        }
    else:
        upload_url = target.upload_url
        headers = dict(target.headers)

    payload = {
        'token': str(session.token),
        'storage_key': session.storage_key,
        'upload_url': upload_url,
        'method': target.method,
        'headers': headers,
        'backend': target.backend,
        'expires_at': session.expires_at.isoformat(),
        'max_bytes': pdf_max_bytes(),
    }
    return session, payload


def get_owned_upload_session(user, token) -> DocumentUploadSession:
    session = DocumentUploadSession.objects.filter(token=token, user=user).first()
    if not session:
        raise ValidationError('نشست آپلود پیدا نشد.')
    if session.is_expired and session.status == DocumentUploadSession.Status.PENDING:
        session.status = DocumentUploadSession.Status.EXPIRED
        session.save(update_fields=['status', 'updated_at'])
        raise ValidationError('نشست آپلود منقضی شده است.')
    return session


def receive_local_upload(
    session: DocumentUploadSession,
    stream: BinaryIO,
    *,
    content_length: int | None,
) -> DocumentUploadSession:
    if session.backend != 'local':
        raise ValidationError('این نشست برای آپلود لوکال نیست.')
    if session.status not in {
        DocumentUploadSession.Status.PENDING,
        DocumentUploadSession.Status.UPLOADED,
    }:
        raise ValidationError('این نشست دیگر قابل آپلود نیست.')
    if session.is_expired:
        raise ValidationError('نشست آپلود منقضی شده است.')

    max_bytes = pdf_max_bytes()
    if content_length is not None and content_length > max_bytes:
        raise ValidationError(f'حجم بیشتر از سقف {max_bytes // (1024 * 1024)}MB است.')

    first = stream.read(5)
    if len(first) < 5 or not first.startswith(b'%PDF-'):
        raise ValidationError('محتوای فایل PDF معتبر نیست.')

    dest = storage.private_media_root() / session.storage_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    try:
        with dest.open('wb') as out:
            out.write(first)
            written += len(first)
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise ValidationError('حجم فایل بیش از حد مجاز است.')
                out.write(chunk)
    except Exception:
        try:
            if dest.is_file():
                dest.unlink()
        except OSError:
            pass
        raise

    session.mark_uploaded(size_bytes=written)
    return session


def finalize_s3_upload(session: DocumentUploadSession) -> DocumentUploadSession:
    """بعد از PUT مستقیم به S3، وجود آبجکت را تأیید کن."""
    if session.backend != 's3':
        raise ValidationError('این نشست S3 نیست.')
    if session.status == DocumentUploadSession.Status.CONSUMED:
        raise ValidationError('این نشست قبلاً مصرف شده است.')
    if session.is_expired and session.status == DocumentUploadSession.Status.PENDING:
        raise ValidationError('نشست آپلود منقضی شده است.')
    if not storage.object_exists(session.storage_key):
        raise ValidationError('فایل روی استوریج پیدا نشد؛ اول آپلود را کامل کن.')
    size = storage.object_size(session.storage_key)
    if size <= 0:
        raise ValidationError('فایل خالی است.')
    if size > pdf_max_bytes():
        storage.delete_object(session.storage_key)
        raise ValidationError('حجم فایل بیش از حد مجاز است.')
    session.mark_uploaded(size_bytes=size)
    return session


def consume_upload_session(user, token: str) -> tuple[DocumentUploadSession, int]:
    """نشست آپلود‌شده را مصرف می‌کند و تعداد صفحات را برمی‌گرداند."""
    session = get_owned_upload_session(user, token)
    if session.status == DocumentUploadSession.Status.PENDING:
        if session.backend == 's3':
            finalize_s3_upload(session)
            session.refresh_from_db()
        else:
            raise ValidationError('هنوز فایلی آپلود نشده است.')
    if session.status != DocumentUploadSession.Status.UPLOADED:
        raise ValidationError('نشست آپلود آمادهٔ ثبت نیست.')
    if not storage.object_exists(session.storage_key):
        raise ValidationError('فایل روی استوریج موجود نیست.')

    page_count = page_count_from_storage_key(session.storage_key)
    return session, page_count


def serialize_document(doc: UserBookDocument | None, request=None) -> dict | None:
    if not doc or not doc.has_file:
        return None
    content_path = reverse(
        'api-shelf-document-content',
        kwargs={'pk': doc.user_book_id},
    )
    content_url = request.build_absolute_uri(content_path) if request else content_path
    return {
        'id': doc.pk,
        'course': doc.course or '',
        'original_filename': doc.original_filename or '',
        'content_type': doc.content_type or 'application/pdf',
        'size_bytes': doc.size_bytes,
        # فقط API احراز هویت‌شده — نه /media/ عمومی
        'content_url': content_url,
        'has_file': True,
    }


def user_owns_document(user, user_book: UserBook) -> bool:
    return user_book.user_id == user.pk


def issue_document_access(user, user_book: UserBook):
    """
    AuthZ + صدور دسترسی کوتاه‌مدت.
    S3 → redirect URL
    local → مسیر فایل خصوصی برای FileResponse در ویو
    """
    if not user_owns_document(user, user_book):
        raise PermissionError('forbidden')
    doc = getattr(user_book, 'document', None)
    if not doc or not doc.has_file:
        raise FileNotFoundError('missing')
    target = storage.create_download_target(
        doc.storage_key,
        filename=doc.original_filename or 'document.pdf',
    )
    return doc, target


@transaction.atomic
def create_digital_shelf_item(
    user,
    *,
    resource_kind: str,
    title: str,
    upload_token: str,
    course: str = '',
    status: str = BookStatus.WANT_TO_READ,
    notes: str = '',
    current_page: int = 0,
) -> tuple[UserBook, UserBookDocument]:
    if not is_digital_kind(resource_kind):
        raise ValidationError({'resource_kind': 'این نوع منبع دیجیتال نیست.'})

    session, page_count = consume_upload_session(user, upload_token)

    book = Book(
        title=title.strip(),
        author='',
        total_pages=page_count,
        resource_kind=resource_kind,
    )
    book.save()

    user_book = UserBook.objects.create(
        user=user,
        book=book,
        current_page=min(max(current_page, 0), page_count),
        status=status,
        notes=notes or '',
        cover_setup_status=SetupStepStatus.SKIPPED,
        vibe_setup_status=SetupStepStatus.SKIPPED,
    )

    doc = UserBookDocument.objects.create(
        user_book=user_book,
        storage_key=session.storage_key,
        course=(course or '').strip()[:255],
        original_filename=session.original_filename,
        content_type=session.content_type,
        size_bytes=session.actual_size_bytes or session.claimed_size_bytes,
    )
    session.mark_consumed()
    return user_book, doc


@transaction.atomic
def attach_storage_key_to_shelf(
    user_book: UserBook,
    *,
    upload_token: str,
    course: str | None = None,
) -> UserBookDocument:
    session, page_count = consume_upload_session(user_book.user, upload_token)

    book = user_book.book
    if book.total_pages != page_count:
        book.total_pages = page_count
        book.save(update_fields=['total_pages', 'updated_at'])
    if user_book.current_page > page_count:
        user_book.current_page = page_count
        user_book.save(update_fields=['current_page', 'updated_at'])

    doc, _ = UserBookDocument.objects.get_or_create(user_book=user_book)
    if doc.storage_key and doc.storage_key != session.storage_key:
        storage.delete_object(doc.storage_key)

    doc.storage_key = session.storage_key
    doc.original_filename = session.original_filename
    doc.content_type = session.content_type
    doc.size_bytes = session.actual_size_bytes or session.claimed_size_bytes
    if course is not None:
        doc.course = (course or '').strip()[:255]
    doc.save()
    session.mark_consumed()
    return doc


@transaction.atomic
def update_digital_shelf_item(
    user_book: UserBook,
    *,
    title: str | None = None,
    course: str | None = None,
    status: str | None = None,
    notes: str | None = None,
    current_page: int | None = None,
    upload_token: str | None = None,
) -> UserBook:
    book = user_book.book
    if book.resource_kind not in DIGITAL_RESOURCE_KINDS:
        raise ValidationError('این آیتم دیجیتال نیست.')

    if title is not None:
        book.title = title.strip()
        book.save()

    if upload_token:
        attach_storage_key_to_shelf(user_book, upload_token=upload_token, course=course)
    elif course is not None:
        doc = UserBookDocument.objects.filter(user_book=user_book).first()
        if doc:
            doc.course = (course or '').strip()[:255]
            doc.save(update_fields=['course', 'updated_at'])

    fields = []
    if status is not None:
        user_book.status = status
        fields.append('status')
    if notes is not None:
        user_book.notes = notes
        fields.append('notes')
    if current_page is not None:
        user_book.current_page = min(max(current_page, 0), user_book.book.total_pages)
        fields.append('current_page')
    if fields:
        fields.append('updated_at')
        user_book.save(update_fields=fields)
    return user_book
