from django.conf import settings
from django.db import models


class Word(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vocabulary_words',
        verbose_name='مالک',
    )
    term = models.CharField('واژه', max_length=200)
    meaning = models.TextField('معنی')
    usage = models.TextField('کاربرد در جمله', blank=True)
    audio = models.FileField(
        'تلفظ',
        upload_to='vocabulary/audio/',
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'واژه'
        verbose_name_plural = 'واژه‌ها'
        indexes = [
            models.Index(fields=['owner', '-created_at']),
        ]

    def __str__(self) -> str:
        return self.term

    @property
    def has_usage(self) -> bool:
        return bool(self.usage and self.usage.strip())

    @property
    def has_audio(self) -> bool:
        return bool(self.audio)
