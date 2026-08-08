from django.db import models


class WaitlistEntry(models.Model):
    """ایمیل ثبت‌شده در لیست انتظار لندینگ."""

    email = models.EmailField('ایمیل', unique=True)
    source = models.CharField('منبع', max_length=64, default='landing', blank=True)
    created_at = models.DateTimeField('زمان ثبت', auto_now_add=True)

    class Meta:
        verbose_name = 'عضویت لیست انتظار'
        verbose_name_plural = 'لیست انتظار'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.email
