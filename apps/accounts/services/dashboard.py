"""Dashboard activity aggregation: heatmap days + streaks.

Activity sources (extensible):
- entries: یادداشت روی کتاب‌ها (Entry.entry_date)
- challenges: ساخت چالش (Challenge.created_at)
- reading: به‌روزرسانی قفسهٔ در حال خواندن / تمام‌شده (UserBook.updated_at)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.books.models import BookStatus, Entry, UserBook
from apps.challenges.models import Challenge, ChallengeStatus
from apps.vocabulary.models import Word

ACTIVITY_TYPES = ('entries', 'challenges', 'reading')

# GitHub-like intensity buckets for total daily count
LEVEL_THRESHOLDS = (0, 1, 3, 5, 8)


def _level_for_count(count: int) -> int:
    level = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if count >= threshold:
            level = i
    return level


def _empty_breakdown() -> dict[str, int]:
    return {key: 0 for key in ACTIVITY_TYPES}


def _heatmap_range(*, weeks: int = 53) -> tuple[date, date]:
    """Return [start, end] covering `weeks` full weeks ending this week (Sat→Fri)."""
    today = timezone.localdate()
    # Align end to today; start so the grid has `weeks * 7` cells ending on today.
    end = today
    start = end - timedelta(days=weeks * 7 - 1)
    # Pad start back to Saturday so columns align like GitHub weeks
    # In Iran week often starts Saturday (weekday() Mon=0 … Sun=6 → Sat=5)
    while start.weekday() != 5:  # Saturday
        start -= timedelta(days=1)
    return start, end


def _aggregate_activity(user, start: date, end: date) -> dict[date, dict[str, int]]:
    days: dict[date, dict[str, int]] = defaultdict(_empty_breakdown)

    entry_rows = (
        Entry.objects.filter(
            user_book__user=user,
            entry_date__gte=start,
            entry_date__lte=end,
        )
        .values('entry_date')
        .annotate(c=Count('id'))
    )
    for row in entry_rows:
        days[row['entry_date']]['entries'] += row['c']

    challenge_rows = (
        Challenge.objects.filter(
            owner=user,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .annotate(d=TruncDate('created_at'))
        .values('d')
        .annotate(c=Count('id'))
    )
    for row in challenge_rows:
        if row['d']:
            days[row['d']]['challenges'] += row['c']

    reading_rows = (
        UserBook.objects.filter(
            user=user,
            updated_at__date__gte=start,
            updated_at__date__lte=end,
            status__in=[BookStatus.READING, BookStatus.FINISHED, BookStatus.PAUSED],
        )
        .annotate(d=TruncDate('updated_at'))
        .values('d')
        .annotate(c=Count('id'))
    )
    for row in reading_rows:
        if row['d']:
            days[row['d']]['reading'] += row['c']

    return days


def _compute_streaks(active_dates: set[date], today: date) -> tuple[int, int]:
    """GitHub-style: current streak may start from today or yesterday."""
    if not active_dates:
        return 0, 0

    # Current streak
    cursor = today if today in active_dates else today - timedelta(days=1)
    current = 0
    if cursor in active_dates:
        while cursor in active_dates:
            current += 1
            cursor -= timedelta(days=1)

    # Longest streak over known active dates
    longest = 0
    run = 0
    prev: date | None = None
    for d in sorted(active_dates):
        if prev is not None and d == prev + timedelta(days=1):
            run += 1
        else:
            run = 1
        prev = d
        longest = max(longest, run)

    return current, longest


def build_heatmap_days(
    aggregated: dict[date, dict[str, int]],
    start: date,
    end: date,
) -> list[dict[str, Any]]:
    result = []
    cursor = start
    while cursor <= end:
        breakdown = aggregated.get(cursor) or _empty_breakdown()
        total = sum(breakdown.values())
        result.append(
            {
                'date': cursor.isoformat(),
                'count': total,
                'level': _level_for_count(total),
                'breakdown': dict(breakdown),
            }
        )
        cursor += timedelta(days=1)
    return result


def get_dashboard_stats(user) -> dict[str, Any]:
    shelf = UserBook.objects.filter(user=user)
    challenges = Challenge.objects.filter(owner=user)
    return {
        'shelf_total': shelf.count(),
        'reading_count': shelf.filter(status=BookStatus.READING).count(),
        'finished_count': shelf.filter(status=BookStatus.FINISHED).count(),
        'entries_count': Entry.objects.filter(user_book__user=user).count(),
        'challenges_active': challenges.filter(
            status__in=[ChallengeStatus.PLANNED, ChallengeStatus.ACTIVE]
        ).count(),
        'challenges_total': challenges.count(),
        'words_count': Word.objects.filter(owner=user).count(),
    }


def get_dashboard_payload(user, *, weeks: int = 53) -> dict[str, Any]:
    start, end = _heatmap_range(weeks=weeks)
    aggregated = _aggregate_activity(user, start, end)
    days = build_heatmap_days(aggregated, start, end)

    active_dates = {
        date.fromisoformat(day['date']) for day in days if day['count'] > 0
    }
    today = timezone.localdate()
    current_streak, longest_streak = _compute_streaks(active_dates, today)

    stats = get_dashboard_stats(user)
    stats.update(
        {
            'streak_current': current_streak,
            'streak_longest': longest_streak,
            'active_days': len(active_dates),
            'total_activities': sum(day['count'] for day in days),
        }
    )

    return {
        'stats': stats,
        'heatmap': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'weeks': weeks,
            'types': list(ACTIVITY_TYPES),
            'days': days,
        },
        'quick': {
            'vocabulary_count': stats['words_count'],
            'challenges_active': stats['challenges_active'],
            'reading_count': stats['reading_count'],
        },
    }
