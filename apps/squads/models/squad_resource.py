import uuid

from django.conf import settings
from django.db import models

from .choices import SquadResourceKind


def squad_resource_upload_to(instance, filename: str) -> str:
    """مسیر ذخیره فایل منابع گروه به صورت private."""
    ext = 'pdf'
    if '.' in (filename or ''):
        candidate = filename.rsplit('.', 1)[-1].lower()
        if candidate.isalnum() and len(candidate) <= 8:
            ext = candidate
    return f'squads/resources/{instance.squad_id or "tmp"}/{uuid.uuid4().hex}.{ext}'


class SquadResource(models.Model):
    """منبع اشتراکی در گروه مطالعه — سند، یادداشت، لینک یا ارجاع به کتاب."""

    squad = models.ForeignKey(
        'squads.StudySquad',
        on_delete=models.CASCADE,
        related_name='resources',
        verbose_name='گروه',
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='squad_resources',
        verbose_name='افزوده‌شده توسط',
    )
    kind = models.CharField(
        'نوع منبع',
        max_length=20,
        choices=SquadResourceKind.choices,
        db_index=True,
    )
    title = models.CharField('عنوان', max_length=255)
    
    storage_key = models.CharField(
        'کلید استوریج',
        max_length=500,
        blank=True,
        default='',
        help_text='برای kind=document — مسیر فایل private',
    )
    original_filename = models.CharField(
        'نام اصلی فایل',
        max_length=255,
        blank=True,
        default='',
    )
    content_type = models.CharField(
        'نوع محتوا',
        max_length=100,
        blank=True,
        default='',
    )
    size_bytes = models.PositiveBigIntegerField(
        'حجم بایت',
        default=0,
        help_text='برای kind=document',
    )
    
    note_content = models.TextField(
        'محتوای یادداشت',
        blank=True,
        default='',
        help_text='برای kind=note',
    )
    
    url = models.URLField(
        'آدرس لینک',
        max_length=500,
        blank=True,
        default='',
        help_text='برای kind=link',
    )
    
    book = models.ForeignKey(
        'books.Book',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='squad_references',
        verbose_name='کتاب مرجع',
        help_text='برای kind=book_ref',
    )
    
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)

    class Meta:
        verbose_name = 'منبع گروه'
        verbose_name_plural = 'منابع گروه'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['squad', 'kind']),
        ]

    def __str__(self) -> str:
        return f'{self.title} ({self.get_kind_display()})'

    @property
    def has_file(self) -> bool:
        return bool(self.storage_key) and self.kind == SquadResourceKind.DOCUMENT
