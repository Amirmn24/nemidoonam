"""
مدیریت اسناد PDF قفسه.

قوانین:
- ذخیره فقط از طریق FileField روی دیسک/MEDIA (نه BLOB در DB)
- تشخیص تعداد صفحات در لحظهٔ آپلود (metadata)
- API فقط URL عمومی مدیا را برمی‌گرداند؛ هیچ Viewای PDF را از جنگو استریم/دانلود نمی‌کند
- نقطهٔ گسترش بعدی: highlights، text layer، annotation
"""

from __future__ import annotations

import logging
from typing import BinaryIO

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction

from apps.books.models import (
    Book,
    BookStatus,
    DIGITAL_RESOURCE_KINDS,
    ResourceKind,
    SetupStepStatus,
    UserBook,
    UserBookDocument,
)

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


def validate_pdf_upload(upload: UploadedFile) -> None:
    if upload is None:
        raise ValidationError({'pdf': 'آپلود فایل PDF الزامی است.'})

    name = (getattr(upload, 'name', '') or '').lower()
    content_type = (getattr(upload, 'content_type', '') or '').lower()
    size = int(getattr(upload, 'size', 0) or 0)

    if size <= 0:
        raise ValidationError({'pdf': 'فایل خالی است.'})
    if size > pdf_max_bytes():
        mb = pdf_max_bytes() // (1024 * 1024)
        raise ValidationError({'pdf': f'حجم PDF نباید بیشتر از {mb} مگابایت باشد.'})
    if not name.endswith('.pdf') and content_type not in ALLOWED_PDF_CONTENT_TYPES:
        raise ValidationError({'pdf': 'فقط فایل PDF پذیرفته می‌شود.'})
    if content_type and content_type not in ALLOWED_PDF_CONTENT_TYPES and not name.endswith('.pdf'):
        raise ValidationError({'pdf': 'نوع فایل معتبر نیست؛ PDF بفرست.'})

    # امضای سادهٔ فایل (%PDF) بدون بارگذاری کل محتوا در RAM پاسخ
    try:
        pos = upload.tell()
    except Exception:
        pos = None
    try:
        head = upload.read(5)
        if not head.startswith(b'%PDF-'):
            raise ValidationError({'pdf': 'محتوای فایل PDF معتبر نیست.'})
    finally:
        try:
            if pos is not None:
                upload.seek(pos)
            else:
                upload.seek(0)
        except Exception:
            pass


def extract_pdf_page_count(stream: BinaryIO) -> int:
    """تعداد صفحات را از ساختار PDF می‌خواند — بدون رندر صفحه."""
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


def media_url_for_field(field, request=None) -> str | None:
    """فقط URL استوریج/مدیا — بدون باز کردن فایل در ویو."""
    if not field or not getattr(field, 'name', None):
        return None
    url = field.url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


def serialize_document(doc: UserBookDocument | None, request=None) -> dict | None:
    if not doc or not doc.has_file:
        return None
    return {
        'id': doc.pk,
        'course': doc.course or '',
        'original_filename': doc.original_filename or '',
        'content_type': doc.content_type or 'application/pdf',
        'size_bytes': doc.size_bytes,
        # فرانت باید مستقیماً از این URL (nginx/CDN/media) بخواند
        'pdf_url': media_url_for_field(doc.pdf, request),
    }


@transaction.atomic
def create_digital_shelf_item(
    user,
    *,
    resource_kind: str,
    title: str,
    pdf: UploadedFile,
    course: str = '',
    status: str = BookStatus.WANT_TO_READ,
    notes: str = '',
    current_page: int = 0,
) -> tuple[UserBook, UserBookDocument]:
    if not is_digital_kind(resource_kind):
        raise ValidationError({'resource_kind': 'این نوع منبع دیجیتال نیست.'})

    validate_pdf_upload(pdf)
    # صفحهٔ شمارش قبل از ذخیره — seek به اول بعد از خواندن
    page_count = extract_pdf_page_count(pdf)
    try:
        pdf.seek(0)
    except Exception:
        pass

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

    doc = attach_pdf_to_shelf(
        user_book,
        pdf=pdf,
        course=course,
        page_count=page_count,
    )
    return user_book, doc


@transaction.atomic
def attach_pdf_to_shelf(
    user_book: UserBook,
    *,
    pdf: UploadedFile,
    course: str | None = None,
    page_count: int | None = None,
) -> UserBookDocument:
    validate_pdf_upload(pdf)
    if page_count is None:
        page_count = extract_pdf_page_count(pdf)
        try:
            pdf.seek(0)
        except Exception:
            pass

    book = user_book.book
    if book.total_pages != page_count:
        book.total_pages = page_count
        book.save(update_fields=['total_pages', 'updated_at'])

    if user_book.current_page > page_count:
        user_book.current_page = page_count
        user_book.save(update_fields=['current_page', 'updated_at'])

    doc, _created = UserBookDocument.objects.get_or_create(user_book=user_book)
    if doc.pdf:
        doc.pdf.delete(save=False)

    doc.pdf = pdf
    doc.original_filename = (getattr(pdf, 'name', '') or '')[:255]
    doc.content_type = (getattr(pdf, 'content_type', '') or 'application/pdf')[:100]
    doc.size_bytes = int(getattr(pdf, 'size', 0) or 0)
    if course is not None:
        doc.course = (course or '').strip()[:255]
    doc.save()
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
    pdf: UploadedFile | None = None,
) -> UserBook:
    book = user_book.book
    if book.resource_kind not in DIGITAL_RESOURCE_KINDS:
        raise ValidationError('این آیتم دیجیتال نیست.')

    if title is not None:
        book.title = title.strip()
        book.save()

    if pdf is not None:
        attach_pdf_to_shelf(user_book, pdf=pdf, course=course)
    elif course is not None:
        doc, _ = UserBookDocument.objects.get_or_create(user_book=user_book)
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
