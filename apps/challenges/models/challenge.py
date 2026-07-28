from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .choices import ChallengePeriodUnit, ChallengeStatus


class Challenge(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenges',
        verbose_name='مالک',
    )
    title = models.CharField('عنوان', max_length=200)
    description = models.TextField('توضیح', blank=True)
    period_unit = models.CharField(
        'واحد زمان',
        max_length=10,
        choices=ChallengePeriodUnit.choices,
        default=ChallengePeriodUnit.WEEK,
    )
    duration = models.PositiveIntegerField(
        'مدت',
        default=1,
        validators=[MinValueValidator(1)],
        help_text='تعداد واحد زمانی (مثلاً ۳ هفته)',
    )
    starts_on = models.DateField('تاریخ شروع')
    ends_on = models.DateField('تاریخ پایان')
    status = models.CharField(
        'وضعیت',
        max_length=20,
        choices=ChallengeStatus.choices,
        default=ChallengeStatus.PLANNED,
        db_index=True,
    )
    books = models.ManyToManyField(
        'books.Book',
        through='ChallengeBook',
        related_name='challenges',
        verbose_name='کتاب‌ها',
    )
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('آخرین به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-starts_on', '-created_at']
        verbose_name = 'چالش'
        verbose_name_plural = 'چالش‌ها'
        indexes = [
            models.Index(fields=['owner', 'status']),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def period_label(self) -> str:
        unit = self.get_period_unit_display()
        return f'{self.duration} {unit}'
