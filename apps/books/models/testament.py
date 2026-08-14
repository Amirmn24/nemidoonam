from django.db import models

from .book import UserBook


class BookTestament(models.Model):
    """وصیت کوتاه خواننده برای یک کتاب فیزیکی — حداکثر یک‌بار به ازای هر قفسه."""

    user_book = models.OneToOneField(
        UserBook,
        on_delete=models.CASCADE,
        related_name='testament',
        verbose_name='کتاب قفسه',
    )
    text = models.CharField('متن وصیت', max_length=160)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'وصیت کتاب'
        verbose_name_plural = 'وصیت‌های کتاب'
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:
        return f'وصیت · {self.user_book_id}'

    @property
    def book(self):
        return self.user_book.book

    @property
    def user(self):
        return self.user_book.user
