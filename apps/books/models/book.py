from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .choices import BookStatus


class Book(models.Model):
    """کاتالوگ سراسری کتاب — عنوان+نویسنده یکتا است؛ کاربران جداگانه به قفسه وصل می‌شوند."""

    title = models.CharField('عنوان', max_length=255)
    author = models.CharField('نویسنده', max_length=255)
    title_normalized = models.CharField(
        'عنوان نرمال',
        max_length=255,
        editable=False,
        db_index=True,
        blank=True,
        default='',
    )
    author_normalized = models.CharField(
        'نویسنده نرمال',
        max_length=255,
        editable=False,
        db_index=True,
        blank=True,
        default='',
    )
    total_pages = models.PositiveIntegerField(
        'تعداد صفحات',
        validators=[MinValueValidator(1)],
    )
    cover = models.ImageField(
        'جلد کتاب',
        upload_to='books/covers/',
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['title', 'author']
        verbose_name = 'کتاب'
        verbose_name_plural = 'کتاب‌ها'
        indexes = [
            models.Index(fields=['title_normalized', 'author_normalized']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['title_normalized', 'author_normalized'],
                name='books_unique_title_author_norm',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.title} — {self.author}'

    def sync_normalized_fields(self) -> None:
        from apps.books.services.matching import fingerprint

        self.title_normalized = fingerprint(self.title)
        self.author_normalized = fingerprint(self.author)

    def save(self, *args, **kwargs):
        self.sync_normalized_fields()
        super().save(*args, **kwargs)


class UserBook(models.Model):
    """نسخهٔ قفسهٔ کاربر از یک کتاب کاتالوگ."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shelf_books',
        verbose_name='کاربر',
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='shelves',
        verbose_name='کتاب',
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
    notes = models.TextField('یادداشت کلی', blank=True)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'کتاب قفسه'
        verbose_name_plural = 'کتاب‌های قفسه'
        indexes = [
            models.Index(fields=['user', 'status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'book'],
                name='books_unique_user_book',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.book} · {self.user}'

    # Proxy catalog fields so templates can keep using book.title etc.
    @property
    def title(self) -> str:
        return self.book.title

    @property
    def author(self) -> str:
        return self.book.author

    @property
    def total_pages(self) -> int:
        return self.book.total_pages

    @property
    def cover(self):
        return self.book.cover

    @property
    def progress_percent(self) -> int:
        if self.book.total_pages <= 0:
            return 0
        return min(100, round((self.current_page / self.book.total_pages) * 100))

    def clean(self):
        from django.core.exceptions import ValidationError

        super().clean()
        if self.book_id and self.current_page > self.book.total_pages:
            raise ValidationError(
                {'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'}
            )
