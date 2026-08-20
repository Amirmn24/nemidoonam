"""هایلایت روی سند دیجیتال — فقط مختصات در DB؛ فایل PDF دست‌نخورده می‌ماند."""

from django.core.validators import MinValueValidator
from django.db import models

from .document import UserBookDocument

# نگاشت رنگ‌های قدیمی نام‌دار → hex (برای مایگریشن/سازگاری)
LEGACY_COLOR_HEX = {
    'yellow': '#facc15',
    'lime': '#84cc16',
    'sky': '#38bdf8',
    'rose': '#f472b6',
}

DEFAULT_HIGHLIGHT_COLOR = '#facc15'


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
        max_length=7,
        default=DEFAULT_HIGHLIGHT_COLOR,
        help_text='رنگ hex مثل #facc15',
        db_index=True,
    )
    quote = models.TextField('متن انتخاب‌شده', blank=True, default='')
    note = models.CharField(
        'یادداشت',
        max_length=500,
        blank=True,
        default='',
        help_text='یادداشت کوتاه برای پیدا کردن در فهرست',
    )
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
