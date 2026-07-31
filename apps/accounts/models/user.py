from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    کاربر سامانه.

    ورود با نام‌کاربری و رمز. فیلدهایی مثل ایمیل و آیدی تلگرام
    اختیاری‌اند و بعداً در پروفایل پر می‌شوند.
    """

    email = models.EmailField('ایمیل', blank=True)
    telegram_id = models.CharField(
        'آیدی تلگرام',
        max_length=64,
        blank=True,
        help_text='مثلاً @username یا شناسه عددی — اختیاری',
    )
    display_name = models.CharField(
        'نام نمایشی',
        max_length=120,
        blank=True,
        help_text='اگر خالی باشد، نام‌کاربری نمایش داده می‌شود.',
    )
    avatar = models.ImageField(
        'عکس پروفایل',
        upload_to='accounts/avatars/',
        blank=True,
        null=True,
    )

    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'
        ordering = ['username']

    def __str__(self) -> str:
        return self.get_display_label()

    def get_display_label(self) -> str:
        return (self.display_name or self.get_full_name() or self.username).strip()
