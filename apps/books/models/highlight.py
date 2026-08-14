"""هایلایت روی سند دیجیتال — فقط مختصات در DB؛ فایل PDF دست‌نخورده می‌ماند."""

from django.core.validators import MinValueValidator
from django.db import models

from .document import UserBookDocument

HIGHLIGHT_COLORS = (
    ('yellow', 'زرد'),
    ('lime', 'سبز'),
    ('sky', 'آبی'),
    ('rose', 'صورتی'),
)

HIGHLIGHT_COLOR_VALUES = {value for value, _label in HIGHLIGHT_COLORS}


class DocumentHighlight(models.Model):
    """
    لایهٔ هایلایت وابسته به سند قفسه.

    مختصات نرمال ۰ تا ۱ نسبت به صفحه است تا با زوم جابه‌جا نشود.
    محتوا داخل فایل PDF نوشته نمی‌شود.
    """

    document = models.ForeignKey(
        UserBookDocument,
        on_delete=models.CASCADE,
        related_name='highlights',
        verbose_name='سند',
    )
    page_number = models.PositiveIntegerField(
        'شماره صفحه',
        validators=[MinValueValidator(1)],
    )
    color = models.CharField(
        'رنگ',
        max_length=16,
        choices=HIGHLIGHT_COLORS,
        default='yellow',
        db_index=True,
    )
    quote = models.TextField('متن انتخاب‌شده', blank=True, default='')
    rects = models.JSONField(
        'مستطیل‌ها',
        default=list,
        help_text='لیست {x, y, w, h} نرمال‌شده نسبت به صفحه (۰ تا ۱).',
    )
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['page_number', 'created_at']
        verbose_name = 'هایلایت سند'
        verbose_name_plural = 'هایلایت‌های سند'
        indexes = [
            models.Index(fields=['document', 'page_number']),
        ]

    def __str__(self) -> str:
        return f'hl · doc {self.document_id} · p{self.page_number}'
