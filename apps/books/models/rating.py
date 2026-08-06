from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .book import UserBook
from .choices import RATING_FACTORS

_SCORE = [MinValueValidator(1), MaxValueValidator(5)]


class BookRating(models.Model):
    """امتیاز چندفاکتوری کاربر به یک کتاب قفسه — برای هر UserBook حداکثر یک رکورد."""

    user_book = models.OneToOneField(
        UserBook,
        on_delete=models.CASCADE,
        related_name='rating',
        verbose_name='کتاب قفسه',
    )
    writing = models.PositiveSmallIntegerField('نثر و زبان', validators=_SCORE)
    content = models.PositiveSmallIntegerField('محتوا و ایده', validators=_SCORE)
    characters = models.PositiveSmallIntegerField('شخصیت‌پردازی', validators=_SCORE)
    pacing = models.PositiveSmallIntegerField('ریتم روایت', validators=_SCORE)
    impact = models.PositiveSmallIntegerField('تأثیر عاطفی', validators=_SCORE)
    review = models.TextField('یادداشت امتیاز', blank=True, default='')
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        verbose_name = 'امتیاز کتاب'
        verbose_name_plural = 'امتیازهای کتاب'
        indexes = [
            models.Index(fields=['user_book']),
        ]

    def __str__(self) -> str:
        return f'{self.user_book} · {self.overall_score}'

    @property
    def factor_scores(self) -> dict[str, int]:
        return {key: getattr(self, key) for key, _ in RATING_FACTORS}

    @property
    def overall_score(self) -> float:
        values = list(self.factor_scores.values())
        if not values:
            return 0.0
        return round(sum(values) / len(values), 2)

    @classmethod
    def factor_labels(cls) -> list[dict[str, str]]:
        return [{'key': key, 'label': label} for key, label in RATING_FACTORS]
