from django.db import models


class ChallengeBook(models.Model):
    """عضویت منبع (کتاب فیزیکی / الکترونیک / جزوه) در چالش."""

    challenge = models.ForeignKey(
        'challenges.Challenge',
        on_delete=models.CASCADE,
        related_name='challenge_books',
        verbose_name='چالش',
    )
    book = models.ForeignKey(
        'books.Book',
        on_delete=models.CASCADE,
        related_name='challenge_links',
        verbose_name='منبع',
        help_text='هر resource_kind روی books.Book مجاز است.',
    )
    target_pages = models.PositiveIntegerField(
        'هدف صفحات',
        blank=True,
        null=True,
        help_text='اختیاری — برای نسخه‌های بعدی',
    )
    created_at = models.DateTimeField('تاریخ افزودن', auto_now_add=True)

    class Meta:
        verbose_name = 'منبع چالش'
        verbose_name_plural = 'منابع چالش'
        constraints = [
            models.UniqueConstraint(
                fields=['challenge', 'book'],
                name='unique_challenge_book',
            ),
        ]
        ordering = ['created_at']

    def __str__(self) -> str:
        return f'{self.challenge_id} → {self.book_id}'
