from django.conf import settings
from django.db import models


class ReadingVibeProfile(models.Model):
    """پروفایل فعلی وایب مطالعاتی کاربر (رادار شخصیت)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_vibe',
        verbose_name='کاربر',
    )
    axes = models.JSONField('محورهای شخصیت', default=dict, blank=True)
    quote = models.TextField('نقل‌قول وایب', blank=True, default='')
    mood_label = models.CharField('برچسب مود', max_length=120, blank=True, default='')
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)

    class Meta:
        verbose_name = 'وایـب مطالعاتی'
        verbose_name_plural = 'وایـب‌های مطالعاتی'

    def __str__(self) -> str:
        return f'vibe · {self.user_id}'


class ReadingVibeLog(models.Model):
    """لاگ هر تغییر وایب بعد از افزودن کتاب."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_vibe_logs',
        verbose_name='کاربر',
    )
    user_book = models.ForeignKey(
        'books.UserBook',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vibe_logs',
        verbose_name='کتاب قفسه',
    )
    book_title = models.CharField('عنوان کتاب', max_length=255, blank=True, default='')
    book_author = models.CharField('نویسنده', max_length=255, blank=True, default='')
    previous_axes = models.JSONField('محورهای قبلی', default=dict, blank=True)
    new_axes = models.JSONField('محورهای جدید', default=dict, blank=True)
    quote = models.TextField('نقل‌قول', blank=True, default='')
    mood_label = models.CharField('برچسب مود', max_length=120, blank=True, default='')
    change_summary = models.TextField('خلاصه تغییر', blank=True, default='')
    created_at = models.DateTimeField('زمان ثبت', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'لاگ وایب'
        verbose_name_plural = 'لاگ‌های وایب'
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self) -> str:
        return f'vibe-log · {self.user_id} · {self.book_title or "—"}'
