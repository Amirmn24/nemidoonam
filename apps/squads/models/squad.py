import secrets

from django.conf import settings
from django.db import models


def generate_invite_code() -> str:
    """تولید کد دعوت ۸ کاراکتری یکتا."""
    return secrets.token_urlsafe(6)[:8]


class StudySquad(models.Model):
    """گروه مطالعه‌ای برای اشتراک‌گذاری منابع و همکاری."""

    name = models.CharField('نام گروه', max_length=200)
    description = models.TextField('توضیح', blank=True, default='')
    course = models.CharField(
        'درس مرتبط',
        max_length=255,
        blank=True,
        default='',
        help_text='نام درس یا موضوع مطالعه — متن آزاد',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_squads',
        verbose_name='مالک',
    )
    invite_code = models.CharField(
        'کد دعوت',
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
        help_text='کد یکتا برای پیوستن به گروه',
    )
    is_active = models.BooleanField('فعال', default=True, db_index=True)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'گروه مطالعه'
        verbose_name_plural = 'گروه‌های مطالعه'
        indexes = [
            models.Index(fields=['owner', 'is_active']),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.invite_code:
            while True:
                code = generate_invite_code()
                if not StudySquad.objects.filter(invite_code=code).exists():
                    self.invite_code = code
                    break
        super().save(*args, **kwargs)
