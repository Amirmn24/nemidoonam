from django.conf import settings
from django.db import models


class SquadRole(models.TextChoices):
    OWNER = 'owner', 'مالک'
    MEMBER = 'member', 'عضو'


class SquadMembership(models.Model):
    """عضویت کاربر در گروه مطالعه."""

    squad = models.ForeignKey(
        'squads.StudySquad',
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name='گروه',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='squad_memberships',
        verbose_name='کاربر',
    )
    role = models.CharField(
        'نقش',
        max_length=10,
        choices=SquadRole.choices,
        default=SquadRole.MEMBER,
        db_index=True,
    )
    joined_at = models.DateTimeField('تاریخ عضویت', auto_now_add=True)

    class Meta:
        verbose_name = 'عضویت گروه'
        verbose_name_plural = 'عضویت‌های گروه'
        constraints = [
            models.UniqueConstraint(
                fields=['squad', 'user'],
                name='unique_squad_user',
            ),
        ]
        ordering = ['joined_at']

    def __str__(self) -> str:
        return f'{self.user} در {self.squad}'
