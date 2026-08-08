"""مدل‌های مرتبط با فایل سند (PDF و بعدها انواع دیگر).

فایل‌ها فقط روی دیسک/استوریج (FileField → MEDIA) نگه داشته می‌شوند؛
محتوای باینری هرگز داخل دیتابیس یا پاسخ API استریم نمی‌شود.
"""

from __future__ import annotations

import uuid

from django.db import models

from .book import UserBook


def document_upload_to(instance, filename: str) -> str:
    """مسیر ذخیره‌سازی جدا از نام اصلی کاربر — جلوگیری از path traversal."""
    ext = 'pdf'
    if '.' in filename:
        candidate = filename.rsplit('.', 1)[-1].lower()
        if candidate.isalnum() and len(candidate) <= 8:
            ext = candidate
    return f'books/documents/{instance.user_book_id or "tmp"}/{uuid.uuid4().hex}.{ext}'


class UserBookDocument(models.Model):
    """
    سند دیجیتال وابسته به یک ردیف قفسه (ebook / booklet).

    نقطهٔ اتصال آینده برای هایلایت، حاشیه‌نویسی و صفحهٔ PDF reader.
    """

    user_book = models.OneToOneField(
        UserBook,
        on_delete=models.CASCADE,
        related_name='document',
        verbose_name='کتاب قفسه',
    )
    pdf = models.FileField(
        'فایل PDF',
        upload_to=document_upload_to,
        max_length=500,
        help_text='فقط مسیر فایل روی استوریج؛ محتوا در دیتابیس ذخیره نمی‌شود.',
    )
    course = models.CharField(
        'درس مرتبط',
        max_length=255,
        blank=True,
        default='',
        help_text='اختیاری — مثلاً نام درس دانشگاهی.',
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
        return f'doc · shelf {self.user_book_id} · {self.original_filename or self.pdf.name}'

    @property
    def has_file(self) -> bool:
        return bool(self.pdf and self.pdf.name)
