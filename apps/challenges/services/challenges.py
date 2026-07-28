from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Prefetch, QuerySet
from django.utils import timezone

from apps.books.models import Book, BookStatus
from apps.challenges.models import (
    Challenge,
    ChallengeBook,
    ChallengePeriodUnit,
    ChallengeStatus,
)


def _add_months(starts_on: date, months: int) -> date:
    month_index = starts_on.month - 1 + months
    year = starts_on.year + month_index // 12
    month = month_index % 12 + 1
    day = min(starts_on.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


@dataclass(frozen=True)
class ChallengeProgress:
    time_percent: int
    completion_percent: int
    books_done: int
    books_total: int
    days_elapsed: int
    days_total: int
    days_left: int
    is_started: bool
    is_overdue: bool


def compute_ends_on(
    starts_on: date,
    period_unit: str,
    duration: int,
) -> date:
    """محاسبه تاریخ پایان از واحد و مدت."""
    if duration < 1:
        raise ValueError('مدت باید حداقل ۱ باشد.')
    if period_unit == ChallengePeriodUnit.DAY:
        return starts_on + timedelta(days=duration)
    if period_unit == ChallengePeriodUnit.WEEK:
        return starts_on + timedelta(weeks=duration)
    if period_unit == ChallengePeriodUnit.MONTH:
        return _add_months(starts_on, duration)
    raise ValueError(f'واحد زمانی نامعتبر: {period_unit}')


def get_challenge_queryset(user) -> QuerySet[Challenge]:
    return (
        Challenge.objects.filter(owner=user)
        .prefetch_related(
            Prefetch(
                'challenge_books',
                queryset=ChallengeBook.objects.select_related('book'),
            ),
            'books',
        )
    )


def get_challenges_by_status(
    user,
    status: str | None = None,
) -> QuerySet[Challenge]:
    qs = get_challenge_queryset(user)
    if status and status in ChallengeStatus.values:
        qs = qs.filter(status=status)
    return qs


def get_user_challenge(user, challenge_id: int) -> Challenge:
    return get_challenge_queryset(user).get(pk=challenge_id)


def compute_progress(
    challenge: Challenge,
    *,
    today: date | None = None,
) -> ChallengeProgress:
    today = today or timezone.localdate()
    starts = challenge.starts_on
    ends = challenge.ends_on

    span = (ends - starts).days
    days_total = max(span, 1)
    is_started = today >= starts
    is_overdue = today > ends

    if not is_started:
        days_elapsed = 0
        time_percent = 0
    elif is_overdue:
        days_elapsed = days_total
        time_percent = 100
    else:
        days_elapsed = (today - starts).days
        time_percent = min(100, round((days_elapsed / days_total) * 100))

    days_left = max(0, (ends - today).days) if not is_overdue else 0

    books = list(challenge.books.all())
    books_total = len(books)
    if books_total == 0:
        completion_percent = 0
        books_done = 0
    else:
        completion_percent = round(
            sum(book.progress_percent for book in books) / books_total
        )
        books_done = sum(1 for book in books if book.status == BookStatus.FINISHED)

    return ChallengeProgress(
        time_percent=time_percent,
        completion_percent=completion_percent,
        books_done=books_done,
        books_total=books_total,
        days_elapsed=days_elapsed,
        days_total=days_total,
        days_left=days_left,
        is_started=is_started,
        is_overdue=is_overdue,
    )


def derive_status(
    challenge: Challenge,
    progress: ChallengeProgress | None = None,
    *,
    today: date | None = None,
) -> str:
    """وضعیت پیشنهادی بر اساس زمان و تکمیل — لغو‌شده دست‌نخورده می‌ماند."""
    if challenge.status == ChallengeStatus.CANCELLED:
        return ChallengeStatus.CANCELLED

    progress = progress or compute_progress(challenge, today=today)
    today = today or timezone.localdate()

    if progress.books_total > 0 and progress.books_done >= progress.books_total:
        return ChallengeStatus.COMPLETED
    if today > challenge.ends_on:
        return ChallengeStatus.FAILED
    if today >= challenge.starts_on:
        return ChallengeStatus.ACTIVE
    return ChallengeStatus.PLANNED


def refresh_status(
    challenge: Challenge,
    *,
    today: date | None = None,
    save: bool = True,
) -> Challenge:
    new_status = derive_status(challenge, today=today)
    if challenge.status != new_status:
        challenge.status = new_status
        if save:
            challenge.save(update_fields=['status', 'updated_at'])
    return challenge


def refresh_challenges_for_user(user, *, today: date | None = None) -> None:
    for challenge in get_challenge_queryset(user).exclude(
        status=ChallengeStatus.CANCELLED
    ):
        refresh_status(challenge, today=today)


def _set_challenge_books(challenge: Challenge, books: list[Book]) -> None:
    ChallengeBook.objects.filter(challenge=challenge).delete()
    ChallengeBook.objects.bulk_create(
        [ChallengeBook(challenge=challenge, book=book) for book in books]
    )


@transaction.atomic
def create_challenge(
    user,
    *,
    title: str,
    description: str,
    period_unit: str,
    duration: int,
    starts_on: date,
    books: list[Book],
) -> Challenge:
    ends_on = compute_ends_on(starts_on, period_unit, duration)
    challenge = Challenge.objects.create(
        owner=user,
        title=title.strip(),
        description=(description or '').strip(),
        period_unit=period_unit,
        duration=duration,
        starts_on=starts_on,
        ends_on=ends_on,
        status=ChallengeStatus.PLANNED,
    )
    _set_challenge_books(challenge, books)
    return refresh_status(challenge)


@transaction.atomic
def update_challenge(
    challenge: Challenge,
    *,
    title: str,
    description: str,
    period_unit: str,
    duration: int,
    starts_on: date,
    books: list[Book],
) -> Challenge:
    challenge.title = title.strip()
    challenge.description = (description or '').strip()
    challenge.period_unit = period_unit
    challenge.duration = duration
    challenge.starts_on = starts_on
    challenge.ends_on = compute_ends_on(starts_on, period_unit, duration)
    challenge.save()
    _set_challenge_books(challenge, books)
    return refresh_status(challenge)

def cancel_challenge(challenge: Challenge) -> Challenge:
    challenge.status = ChallengeStatus.CANCELLED
    challenge.save(update_fields=['status', 'updated_at'])
    return challenge
