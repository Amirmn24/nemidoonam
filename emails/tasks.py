from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

from apps.challenges.models import Challenge, ChallengeStatus

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_challenge_started_email(self, challenge_id: int) -> bool:
    from emails.services import notify_challenge_started

    try:
        challenge = (
            Challenge.objects.select_related('owner')
            .prefetch_related('books')
            .get(pk=challenge_id)
        )
    except Challenge.DoesNotExist:
        logger.warning('چالش %s برای ایمیل شروع پیدا نشد.', challenge_id)
        return False
    return notify_challenge_started(challenge)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_challenge_completed_email(self, challenge_id: int) -> bool:
    from emails.services import notify_challenge_completed

    try:
        challenge = (
            Challenge.objects.select_related('owner')
            .prefetch_related('books')
            .get(pk=challenge_id)
        )
    except Challenge.DoesNotExist:
        logger.warning('چالش %s برای ایمیل اتمام پیدا نشد.', challenge_id)
        return False
    return notify_challenge_completed(challenge)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def evaluate_challenge_emails_task(self, challenge_id: int) -> None:
    from emails.services import evaluate_challenge_emails

    try:
        challenge = (
            Challenge.objects.select_related('owner')
            .prefetch_related('books')
            .get(pk=challenge_id)
        )
    except Challenge.DoesNotExist:
        return
    evaluate_challenge_emails(challenge)


@shared_task
def evaluate_user_challenge_emails_task(user_id: int) -> None:
    from django.contrib.auth import get_user_model

    from emails.services import evaluate_user_challenge_emails

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return
    evaluate_user_challenge_emails(user)


@shared_task
def on_reading_progress_task(user_id: int, book_id: int | None = None) -> int:
    """
    بعد از تغییر پیشرفت قفسه: وضعیت چالش‌های مرتبط را تازه می‌کند
    و ایمیل‌های پیشرفت/اتمام را ارزیابی می‌کند.
    """
    from apps.challenges.services import refresh_status
    from emails.services import evaluate_challenge_emails

    qs = (
        Challenge.objects.filter(owner_id=user_id)
        .exclude(status=ChallengeStatus.CANCELLED)
        .select_related('owner')
        .prefetch_related('books')
    )
    if book_id is not None:
        qs = qs.filter(books__id=book_id).distinct()

    count = 0
    for challenge in qs:
        refresh_status(challenge)
        evaluate_challenge_emails(challenge)
        count += 1
    return count


@shared_task
def check_all_challenge_reminders() -> dict:
    """بررسی دوره‌ای همه چالش‌های فعال برای یادآوری زمانی و پیشرفت."""
    from apps.challenges.services import refresh_status
    from emails.services import evaluate_challenge_emails

    today = timezone.localdate()
    qs = (
        Challenge.objects.exclude(status=ChallengeStatus.CANCELLED)
        .select_related('owner')
        .prefetch_related('books')
    )
    checked = 0
    for challenge in qs.iterator(chunk_size=100):
        refresh_status(challenge, today=today)
        evaluate_challenge_emails(challenge, today=today)
        checked += 1
    logger.info('بررسی یادآوری ایمیل برای %s چالش انجام شد.', checked)
    return {'checked': checked}
