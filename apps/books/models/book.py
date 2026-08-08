from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from .choices import BookStatus, DIGITAL_RESOURCE_KINDS, ResourceKind, SetupStepStatus


class Book(models.Model):
    """کاتالوگ منبع — فیزیکی با عنوان+نویسنده یکتا؛ دیجیتال بدون اجبار نویسنده."""

    resource_kind = models.CharField(
        'نوع منبع',
        max_length=20,
        choices=ResourceKind.choices,
        default=ResourceKind.PHYSICAL,
        db_index=True,
    )
    title = models.CharField('عنوان', max_length=255)
    author = models.CharField(
        'نویسنده',
        max_length=255,
        blank=True,
        default='',
        help_text='برای کتاب فیزیکی الزامی است؛ برای الکترونیک/جزوه خالی می‌ماند.',
    )
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
        verbose_name = 'کتاب / جزوه'
        verbose_name_plural = 'کتاب‌ها و جزوه‌ها'
        indexes = [
            models.Index(fields=['title_normalized', 'author_normalized']),
            models.Index(fields=['resource_kind']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['title_normalized', 'author_normalized'],
                condition=Q(resource_kind=ResourceKind.PHYSICAL),
                name='books_unique_physical_title_author_norm',
            ),
        ]

    def __str__(self) -> str:
        if self.author:
            return f'{self.title} — {self.author}'
        return self.title

    @property
    def is_digital(self) -> bool:
        return self.resource_kind in DIGITAL_RESOURCE_KINDS

    def sync_normalized_fields(self) -> None:
        from apps.books.services.matching import fingerprint

        self.title_normalized = fingerprint(self.title)
        self.author_normalized = fingerprint(self.author)

    def save(self, *args, **kwargs):
        self.sync_normalized_fields()
        super().save(*args, **kwargs)


class UserBook(models.Model):
    """نسخهٔ قفسهٔ کاربر از یک منبع کاتالوگ."""

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
    midpoint_prompt_done = models.BooleanField(
        'پاپ‌آپ نیمه‌راه انجام شده',
        default=False,
        help_text='اولین عبور از نیمهٔ کتاب برای پیش‌بینی پایان پرسیده شده است.',
    )
    cover_setup_status = models.CharField(
        'وضعیت آماده‌سازی جلد',
        max_length=20,
        choices=SetupStepStatus.choices,
        default=SetupStepStatus.IDLE,
        db_index=True,
    )
    vibe_setup_status = models.CharField(
        'وضعیت آماده‌سازی وایب',
        max_length=20,
        choices=SetupStepStatus.choices,
        default=SetupStepStatus.IDLE,
        db_index=True,
    )
    peer_viewpoint_revealed = models.BooleanField(
        'دیدگاه دیگران دیده شده',
        default=False,
        help_text='یک‌بار دیدگاه پایانی تصادفی دیگران برای این کتاب نشان داده شده است.',
    )
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
    def resource_kind(self) -> str:
        return self.book.resource_kind

    @property
    def is_digital(self) -> bool:
        return self.book.is_digital

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
