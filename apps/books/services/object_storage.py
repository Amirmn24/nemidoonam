"""
لایهٔ ذخیره‌سازی اسناد خصوصی (PDF).

- Local: فایل زیر PRIVATE_MEDIA_ROOT (هرگز زیر /media/ عمومی سرو نمی‌شود)
- S3-compatible: آپلود/دانلود با Presigned URL تا worker جنگو قفل نشود و مقیاس افقی ممکن باشد
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO
from urllib.parse import urljoin

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UploadTarget:
    storage_key: str
    upload_url: str
    method: str  # PUT
    headers: dict[str, str]
    backend: str  # local | s3


@dataclass(frozen=True)
class DownloadTarget:
    url: str
    method: str  # GET / redirect
    backend: str
    is_redirect: bool


def documents_use_s3() -> bool:
    return bool(getattr(settings, 'DOCUMENTS_USE_S3', False))


def private_media_root() -> Path:
    root = Path(getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.BASE_DIR / 'private_media'))
    root.mkdir(parents=True, exist_ok=True)
    return root


def build_storage_key(*, user_id: int, filename: str = 'file.pdf') -> str:
    ext = 'pdf'
    if '.' in (filename or ''):
        candidate = filename.rsplit('.', 1)[-1].lower()
        if candidate.isalnum() and len(candidate) <= 8:
            ext = candidate
    return f'documents/{user_id}/{uuid.uuid4().hex}.{ext}'


def _s3_client():
    import boto3
    from botocore.client import Config

    return boto3.client(
        's3',
        endpoint_url=getattr(settings, 'AWS_S3_ENDPOINT_URL', None) or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
        config=Config(signature_version='s3v4'),
    )


def _s3_bucket() -> str:
    return settings.AWS_STORAGE_BUCKET_NAME


def create_upload_target(
    *,
    user_id: int,
    filename: str,
    content_type: str,
    request=None,
) -> UploadTarget:
    storage_key = build_storage_key(user_id=user_id, filename=filename)
    if documents_use_s3():
        client = _s3_client()
        expires = int(getattr(settings, 'DOCUMENTS_UPLOAD_URL_EXPIRES', 600))
        url = client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': _s3_bucket(),
                'Key': storage_key,
                'ContentType': content_type or 'application/pdf',
            },
            ExpiresIn=expires,
            HttpMethod='PUT',
        )
        return UploadTarget(
            storage_key=storage_key,
            upload_url=url,
            method='PUT',
            headers={'Content-Type': content_type or 'application/pdf'},
            backend='s3',
        )

    # لوکال: آپلود از طریق API خصوصی با توکن (نه /media/)
    from django.urls import reverse

    # token در لایهٔ بالاتر ست می‌شود؛ اینجا فقط مسیر نسبی placeholder نیست —
    # caller باید upload_url را با token بسازد. این تابع فقط key می‌دهد.
    # برای یکپارچگی، upload_url را بعداً در service ست می‌کنیم.
    return UploadTarget(
        storage_key=storage_key,
        upload_url='',  # filled by documents service with token
        method='PUT',
        headers={'Content-Type': content_type or 'application/pdf'},
        backend='local',
    )


def create_download_target(storage_key: str, *, filename: str = 'document.pdf') -> DownloadTarget:
    if documents_use_s3():
        client = _s3_client()
        expires = int(getattr(settings, 'DOCUMENTS_DOWNLOAD_URL_EXPIRES', 120))
        url = client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': _s3_bucket(),
                'Key': storage_key,
                'ResponseContentDisposition': f'inline; filename="{filename}"',
                'ResponseContentType': 'application/pdf',
            },
            ExpiresIn=expires,
            HttpMethod='GET',
        )
        return DownloadTarget(url=url, method='GET', backend='s3', is_redirect=True)

    # لوکال: فقط از طریق endpoint احراز هویت‌شده خوانده می‌شود (نه URL عمومی)
    return DownloadTarget(url='', method='GET', backend='local', is_redirect=False)


def object_exists(storage_key: str) -> bool:
    if documents_use_s3():
        client = _s3_client()
        try:
            client.head_object(Bucket=_s3_bucket(), Key=storage_key)
            return True
        except Exception:
            return False
    path = private_media_root() / storage_key
    return path.is_file()


def object_size(storage_key: str) -> int:
    if documents_use_s3():
        client = _s3_client()
        meta = client.head_object(Bucket=_s3_bucket(), Key=storage_key)
        return int(meta.get('ContentLength') or 0)
    path = private_media_root() / storage_key
    return path.stat().st_size if path.is_file() else 0


def save_local_upload(storage_key: str, stream: BinaryIO) -> int:
    """نوشتن چانکی روی دیسک خصوصی — برای backend لوکال."""
    dest = private_media_root() / storage_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with dest.open('wb') as out:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            written += len(chunk)
    return written


def open_local_file(storage_key: str):
    path = private_media_root() / storage_key
    if not path.is_file():
        raise FileNotFoundError(storage_key)
    return path.open('rb')


def delete_object(storage_key: str) -> None:
    if not storage_key:
        return
    if documents_use_s3():
        try:
            _s3_client().delete_object(Bucket=_s3_bucket(), Key=storage_key)
        except Exception as exc:
            logger.warning('S3 delete failed for %s: %s', storage_key, exc.__class__.__name__)
        return
    path = private_media_root() / storage_key
    try:
        if path.is_file():
            path.unlink()
    except OSError as exc:
        logger.warning('Local delete failed for %s: %s', storage_key, exc)


def open_object_for_read(storage_key: str):
    """
    برای کارهای کوتاه مثل شمارش صفحات.
    S3: دانلود به NamedTemporaryFile روی دیسک (نه نگه داشتن کل فایل در RAM پاسخ HTTP).
    """
    if not documents_use_s3():
        return open_local_file(storage_key), None

    import tempfile

    client = _s3_client()
    tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
    tmp_path = Path(tmp.name)
    try:
        client.download_fileobj(_s3_bucket(), storage_key, tmp)
        tmp.flush()
        tmp.seek(0)
        return tmp, tmp_path
    except Exception:
        tmp.close()
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise
