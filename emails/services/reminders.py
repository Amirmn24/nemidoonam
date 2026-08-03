from __future__ import annotations

from datetime import date

from django.utils import timezone
from django.utils.formats import date_format

from apps.challenges.models import Challenge, ChallengeStatus
from apps.challenges.services import compute_progress
from emails.models import ChallengeEmailKind
from emails.services import copy
from emails.services.sending import already_sent, send_challenge_mail


def _display_name(user) -> str:
    return user.get_display_label()


def _book_titles(challenge: Challenge) -> list[str]:
    return [b.title for b in challenge.books.all()]


def _format_date(value: date) -> str:
    return date_format(value, format='j F Y', use_l10n=True)


def _send(challenge, kind: str, payload: tuple[str, str, str]) -> bool:
    subject, body, html_body = payload
    return send_challenge_mail(
        challenge,
        kind,
        subject=subject,
        body=body,
        html_body=html_body,
    )


def notify_challenge_started(challenge: Challenge) -> bool:
    if already_sent(challenge.pk, ChallengeEmailKind.STARTED):
        return False
    return _send(
        challenge,
        ChallengeEmailKind.STARTED,
        copy.challenge_started(
            name=_display_name(challenge.owner),
            challenge_title=challenge.title,
            period_label=challenge.period_label,
            book_titles=_book_titles(challenge),
            ends_on=_format_date(challenge.ends_on),
        ),
    )


def notify_halfway_time(challenge: Challenge, *, today: date | None = None) -> bool:
    if challenge.status in {
        ChallengeStatus.COMPLETED,
        ChallengeStatus.FAILED,
        ChallengeStatus.CANCELLED,
    }:
        return False
    if already_sent(challenge.pk, ChallengeEmailKind.HALFWAY_TIME):
        return False

    progress = compute_progress(challenge, today=today)
    if progress.time_percent < 50 or not progress.is_started or progress.is_overdue:
        return False

    return _send(
        challenge,
        ChallengeEmailKind.HALFWAY_TIME,
        copy.halfway_time(
            name=_display_name(challenge.owner),
            challenge_title=challenge.title,
            days_left=progress.days_left,
            completion_percent=progress.completion_percent,
            book_titles=_book_titles(challenge),
        ),
    )


def notify_one_day_before(challenge: Challenge, *, today: date | None = None) -> bool:
    if challenge.status in {
        ChallengeStatus.COMPLETED,
        ChallengeStatus.FAILED,
        ChallengeStatus.CANCELLED,
    }:
        return False
    if already_sent(challenge.pk, ChallengeEmailKind.ONE_DAY_BEFORE):
        return False

    progress = compute_progress(challenge, today=today)
    if progress.days_total <= 2:
        return False
    if progress.days_left != 1 or progress.is_overdue:
        return False

    return _send(
        challenge,
        ChallengeEmailKind.ONE_DAY_BEFORE,
        copy.one_day_before(
            name=_display_name(challenge.owner),
            challenge_title=challenge.title,
            completion_percent=progress.completion_percent,
            book_titles=_book_titles(challenge),
        ),
    )


def notify_halfway_progress(challenge: Challenge, *, today: date | None = None) -> bool:
    if challenge.status in {
        ChallengeStatus.COMPLETED,
        ChallengeStatus.FAILED,
        ChallengeStatus.CANCELLED,
    }:
        return False
    if already_sent(challenge.pk, ChallengeEmailKind.HALFWAY_PROGRESS):
        return False

    progress = compute_progress(challenge, today=today)
    if progress.completion_percent < 50:
        return False

    return _send(
        challenge,
        ChallengeEmailKind.HALFWAY_PROGRESS,
        copy.halfway_progress(
            name=_display_name(challenge.owner),
            challenge_title=challenge.title,
            completion_percent=progress.completion_percent,
            days_left=progress.days_left,
            book_titles=_book_titles(challenge),
        ),
    )


def notify_challenge_completed(challenge: Challenge, *, today: date | None = None) -> bool:
    today = today or timezone.localdate()
    if challenge.status != ChallengeStatus.COMPLETED:
        return False
    if today > challenge.ends_on:
        return False
    if already_sent(challenge.pk, ChallengeEmailKind.COMPLETED):
        return False

    progress = compute_progress(challenge, today=today)
    return _send(
        challenge,
        ChallengeEmailKind.COMPLETED,
        copy.challenge_completed(
            name=_display_name(challenge.owner),
            challenge_title=challenge.title,
            days_left=progress.days_left,
            book_titles=_book_titles(challenge),
        ),
    )


def evaluate_challenge_emails(
    challenge: Challenge,
    *,
    today: date | None = None,
    include_started: bool = False,
) -> None:
    """بررسی و ارسال ایمیل‌های لازم برای یک چالش."""
    if include_started:
        notify_challenge_started(challenge)
    notify_halfway_time(challenge, today=today)
    notify_one_day_before(challenge, today=today)
    notify_halfway_progress(challenge, today=today)
    notify_challenge_completed(challenge, today=today)


def evaluate_user_challenge_emails(user, *, today: date | None = None) -> None:
    qs = (
        Challenge.objects.filter(owner=user)
        .exclude(status=ChallengeStatus.CANCELLED)
        .select_related('owner')
        .prefetch_related('books')
    )
    for challenge in qs:
        evaluate_challenge_emails(challenge, today=today)
