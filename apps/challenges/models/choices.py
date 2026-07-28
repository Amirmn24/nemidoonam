from django.db import models


class ChallengePeriodUnit(models.TextChoices):
    DAY = 'day', 'روز'
    WEEK = 'week', 'هفته'
    MONTH = 'month', 'ماه'


class ChallengeStatus(models.TextChoices):
    PLANNED = 'planned', 'برنامه‌ریزی‌شده'
    ACTIVE = 'active', 'فعال'
    COMPLETED = 'completed', 'تمام‌شده'
    FAILED = 'failed', 'ناتمام'
    CANCELLED = 'cancelled', 'لغو‌شده'
