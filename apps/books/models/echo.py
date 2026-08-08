import uuid

from django.conf import settings
from django.db import models

from .entry import Entry


class EchoClaim(models.Model):
    """یک‌بار مصرف شبانهٔ پژواک برای هر کاربر."""

    class Resolution(models.TextChoices):
        OPEN = 'open', 'باز'
        SAVED = 'saved', 'ذخیره‌شده در قفسه'
        DISMISSED = 'dismissed', 'رد شده'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='echo_claims',
        verbose_name='کاربر',
    )
    night_key = models.DateField(
        'کلید شب',
        db_index=True,
        help_text='شب پنجرهٔ ۲۰:۰۰ تا ۰۸:۰۰ (تاریخ شروع پنجره به وقت محلی).',
    )
    token = models.UUIDField(
        'توکن',
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
    )
    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name='echo_claims',
        verbose_name='یادداشت',
    )
    book_revealed = models.BooleanField('نام کتاب آشکار شده', default=False)
    resolution = models.CharField(
        'نتیجه',
        max_length=20,
        choices=Resolution.choices,
        default=Resolution.OPEN,
        db_index=True,
    )
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'پژواک'
        verbose_name_plural = 'پژواک‌ها'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'night_key'],
                name='books_unique_echo_user_night',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'night_key']),
        ]

    def __str__(self) -> str:
        return f'echo · {self.user_id} · {self.night_key}'
