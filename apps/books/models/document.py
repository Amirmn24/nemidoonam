"""مدل‌های سند خصوصی — فایل روی استوریج خصوصی/S3؛ در DB فقط کلید و متادیتا."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from .book import UserBook


def document_upload_to(instance, filename: str) -> str:
    """سازگاری با مایگریشن قدیمی؛ دیگر برای ذخیرهٔ جدید استفاده نمی‌شود."""
    ext = 'pdf'
    if '.' in (filename or ''):
        candidate = filename.rsplit('.', 1)[-1].lower()
        if candidate.isalnum() and len(candidate) <= 8:
            ext = candidate
    return f'books/documents/{getattr(instance, "user_book_id", None) or "tmp"}/{uuid.uuid4().hex}.{ext}'


class DocumentUploadSession(models.Model):
    """نشست آپلود مستقیم (Presigned / local private PUT) قبل از اتصال به قفسه."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'در انتظار آپلود'
        UPLOADED = 'uploaded', 'آپلود شده'
        CONSUMED = 'consumed', 'مصرف‌شده'
        EXPIRED = 'expired', 'منقضی'

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='document_upload_sessions',
    )
    storage_key = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255, blank=True, default='')
    content_type = models.CharField(max_length=100, default='application/pdf')
    claimed_size_bytes = models.PositiveBigIntegerField(default=0)
    actual_size_bytes = models.PositiveBigIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    backend = models.CharField(max_length=20, default='local')
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'نشست آپلود سند'
        verbose_name_plural = 'نشست‌های آپلود سند'

    def __str__(self) -> str:
        return f'upload · {self.token} · {self.status}'

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def mark_uploaded(self, *, size_bytes: int) -> None:
        self.status = self.Status.UPLOADED
        self.actual_size_bytes = size_bytes
        self.save(update_fields=['status', 'actual_size_bytes', 'updated_at'])

    def mark_consumed(self) -> None:
        self.status = self.Status.CONSUMED
        self.save(update_fields=['status', 'updated_at'])


class UserBookDocument(models.Model):
    """
    سند دیجیتال قفسه.

    storage_key به آبجکت خصوصی اشاره می‌کند (S3 یا PRIVATE_MEDIA_ROOT).
    هرگز URL عمومی /media/ برنمی‌گردانیم.
    """

    user_book = models.OneToOneField(
        UserBook,
        on_delete=models.CASCADE,
        related_name='document',
        verbose_name='کتاب قفسه',
    )
    storage_key = models.CharField(
        'کلید استوریج',
        max_length=500,
        help_text='مسیر آبجکت خصوصی؛ محتوا در دیتابیس نیست.',
    )
    course = models.CharField(
        'درس مرتبط',
        max_length=255,
        blank=True,
        default='',
    )
    original_filename = models.CharField('نام اصلی فایل', max_length=255, blank=True, default='')
    content_type = models.CharField('نوع محتوا', max_length=100, blank=True, default='application/pdf')
    size_bytes = models.PositiveBigIntegerField('حجم بایت', default=0)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        verbose_name = 'سند قفسه'
        verbose_name_plural = 'اسناد قفسه'

    def __str__(self) -> str:
        return f'doc · shelf {self.user_book_id} · {self.original_filename or self.storage_key}'

    @property
    def has_file(self) -> bool:
        return bool(self.storage_key)
