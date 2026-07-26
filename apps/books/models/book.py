from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .choices import BookStatus


class Book(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='books',
        verbose_name='مالک',
    )
    title = models.CharField('عنوان', max_length=255)
    author = models.CharField('نویسنده', max_length=255)
    total_pages = models.PositiveIntegerField(
        'تعداد صفحات',
        validators=[MinValueValidator(1)],
    )
    current_page = models.PositiveIntegerField(
        'صفحه فعلی',
        default=0,
        validators=[MinValueValidator(0)],
    )
    status = models.CharField(
        'وضعیت',
        max_length=20,
        choices=BookStatus.choices,
        default=BookStatus.WANT_TO_READ,
        db_index=True,
    )
    cover = models.ImageField(
        'جلد کتاب',
        upload_to='books/covers/',
        blank=True,
        null=True,
    )
    notes = models.TextField('یادداشت کلی', blank=True)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'کتاب'
        verbose_name_plural = 'کتاب‌ها'
        indexes = [
            models.Index(fields=['owner', 'status']),
        ]

    def __str__(self) -> str:
        return f'{self.title} — {self.author}'

    @property
    def progress_percent(self) -> int:
        if self.total_pages <= 0:
            return 0
        return min(100, round((self.current_page / self.total_pages) * 100))

    def clean(self):
        from django.core.exceptions import ValidationError

        super().clean()
        if self.current_page > self.total_pages:
            raise ValidationError(
                {'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'}
            )
