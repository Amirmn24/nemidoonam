from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from .book import UserBook
from .choices import EntryKind, EntryMediaType


class Entry(models.Model):
    user_book = models.ForeignKey(
        UserBook,
        on_delete=models.CASCADE,
        related_name='entries',
        verbose_name='کتاب قفسه',
    )
    media_type = models.CharField(
        'نوع محتوا',
        max_length=10,
        choices=EntryMediaType.choices,
        default=EntryMediaType.TEXT,
    )
    kind = models.CharField(
        'نوع دیدگاه',
        max_length=20,
        choices=EntryKind.choices,
        default=EntryKind.VIEWPOINT,
        db_index=True,
    )
    page_number = models.PositiveIntegerField(
        'شماره صفحه',
        validators=[MinValueValidator(1)],
    )
    text_content = models.TextField('متن', blank=True)
    image = models.ImageField(
        'تصویر',
        upload_to='books/entries/images/',
        blank=True,
        null=True,
    )
    audio = models.FileField(
        'فایل صوتی',
        upload_to='books/entries/audio/',
        blank=True,
        null=True,
    )
    is_public = models.BooleanField(
        'عمومی',
        default=False,
        help_text='اگر فعال باشد، بعداً می‌توان این دیدگاه را عمومی کرد.',
    )
    is_sealed = models.BooleanField(
        'مهروموم',
        default=False,
        help_text='تا پایان کتاب محتوا قفل می‌ماند و دیده/شنیده نمی‌شود.',
    )
    entry_date = models.DateField('تاریخ', default=timezone.localdate)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name = 'یادداشت'
        verbose_name_plural = 'یادداشت‌ها'
        indexes = [
            models.Index(fields=['user_book', 'page_number']),
            models.Index(fields=['user_book', 'kind']),
        ]

    def __str__(self) -> str:
        return f'{self.get_kind_display()} · صفحه {self.page_number}'

    @property
    def book(self):
        return self.user_book.book

    def clean(self):
        super().clean()
        errors = {}

        if (
            self.user_book_id
            and self.page_number
            and self.page_number > self.user_book.book.total_pages
        ):
            errors['page_number'] = 'شماره صفحه نمی‌تواند بیشتر از تعداد صفحات کتاب باشد.'

        if self.media_type == EntryMediaType.TEXT and not self.text_content.strip():
            errors['text_content'] = 'برای محتوای متنی، نوشتن متن الزامی است.'
        elif self.media_type == EntryMediaType.IMAGE and not self.image:
            errors['image'] = 'برای محتوای تصویری، آپلود تصویر الزامی است.'
        elif self.media_type == EntryMediaType.VOICE and not self.audio:
            errors['audio'] = 'برای محتوای صوتی، ضبط ویس الزامی است.'

        if errors:
            raise ValidationError(errors)
