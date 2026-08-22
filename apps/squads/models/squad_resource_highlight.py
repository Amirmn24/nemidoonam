"""هایلایت گروهی روی سند PDF در SquadResource."""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .squad_resource import SquadResource

# پالت رنگ برای اعضای گروه
SQUAD_HIGHLIGHT_COLORS = [
    '#facc15',  # yellow
    '#84cc16',  # lime
    '#38bdf8',  # sky
    '#f472b6',  # rose
    '#a78bfa',  # purple
    '#fb923c',  # orange
    '#34d399',  # emerald
    '#f87171',  # red
]


def get_user_highlight_color(user_id: int) -> str:
    """رنگ هایلایت کاربر بر اساس user_id — ثابت برای هر کاربر."""
    return SQUAD_HIGHLIGHT_COLORS[user_id % len(SQUAD_HIGHLIGHT_COLORS)]


class SquadResourceHighlight(models.Model):
    """
    هایلایت گروهی روی سند PDF در SquadResource.
    
    مختصات نرمال ۰ تا ۱ نسبت به صفحه است تا با زوم جابه‌جا نشود.
    رنگ بر اساس owner محاسبه می‌شه تا هر عضو رنگ ثابتی داشته باشه.
    """

    resource = models.ForeignKey(
        SquadResource,
        on_delete=models.CASCADE,
        related_name='highlights',
        verbose_name='منبع',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='squad_highlights',
        verbose_name='مالک',
    )
    page_number = models.PositiveIntegerField(
        'شماره صفحه',
        validators=[MinValueValidator(1)],
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
        verbose_name = 'هایلایت گروهی'
        verbose_name_plural = 'هایلایت‌های گروهی'
        indexes = [
            models.Index(fields=['resource', 'page_number']),
            models.Index(fields=['resource', 'owner']),
        ]

    def __str__(self) -> str:
        return f'hl · resource {self.resource_id} · p{self.page_number} · @{self.owner.username}'

    @property
    def color(self) -> str:
        """رنگ هایلایت بر اساس owner."""
        return get_user_highlight_color(self.owner_id)
