from django.db import models


class ChallengeEmailKind(models.TextChoices):
    STARTED = 'started', 'شروع چالش'
    HALFWAY_TIME = 'halfway_time', 'نیمهٔ زمان'
    ONE_DAY_BEFORE = 'one_day_before', 'یک روز قبل'
    HALFWAY_PROGRESS = 'halfway_progress', 'نیمهٔ پیشرفت'
    COMPLETED = 'completed', 'اتمام چالش'


class ChallengeEmailLog(models.Model):
    """ثبت ایمیل‌های ارسال‌شده برای هر چالش تا تکراری ارسال نشود."""

    challenge = models.ForeignKey(
        'challenges.Challenge',
        on_delete=models.CASCADE,
        related_name='email_logs',
        verbose_name='چالش',
    )
    kind = models.CharField(
        'نوع ایمیل',
        max_length=32,
        choices=ChallengeEmailKind.choices,
    )
    sent_at = models.DateTimeField('زمان ارسال', auto_now_add=True)
    to_email = models.EmailField('گیرنده')

    class Meta:
        verbose_name = 'لاگ ایمیل چالش'
        verbose_name_plural = 'لاگ ایمیل‌های چالش'
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(
                fields=['challenge', 'kind'],
                name='unique_challenge_email_kind',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.challenge_id} · {self.get_kind_display()}'
