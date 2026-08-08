"""ویژگی‌های اجتماعی کتاب: دیدگاه پایانی و آشکارسازی یک‌بارهٔ دیدگاه دیگران.

پژواک شبانه در apps.books.services.echo پیاده شده است.
"""

from __future__ import annotations

import random
import re
from typing import Any

from django.db import transaction
from django.db.models import QuerySet

from apps.books.models import BookStatus, Entry, EntryKind, EntryMediaType, UserBook

FINAL_VIEWPOINT_MAX_LEN = 4000
PEER_POOL_LIMIT = 250

_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def sanitize_public_text(text: str, *, max_len: int = FINAL_VIEWPOINT_MAX_LEN) -> str:
    cleaned = _CONTROL_CHARS.sub('', (text or '')).replace('\r\n', '\n').replace('\r', '\n')
    cleaned = cleaned.strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip()
    return cleaned


def user_has_final_viewpoint(user_book: UserBook) -> bool:
    return user_book.entries.filter(kind=EntryKind.FINAL_VIEWPOINT).exists()


def public_final_queryset(catalog_book_id: int) -> QuerySet[Entry]:
    return Entry.objects.filter(
        user_book__book_id=catalog_book_id,
        kind=EntryKind.FINAL_VIEWPOINT,
        is_public=True,
        media_type__in=[EntryMediaType.TEXT, EntryMediaType.VOICE],
    ).select_related('user_book__user', 'user_book__book')


def peer_final_queryset(user_book: UserBook) -> QuerySet[Entry]:
    qs = public_final_queryset(user_book.book_id).exclude(user_book__user_id=user_book.user_id)
    return qs.exclude(media_type=EntryMediaType.TEXT, text_content='').exclude(
        media_type=EntryMediaType.VOICE,
        audio='',
    )


def count_peer_final_viewpoints(user_book: UserBook) -> int:
    return peer_final_queryset(user_book).count()


def is_first_final_for_catalog(catalog_book_id: int, *, before_entry_id: int | None = None) -> bool:
    qs = public_final_queryset(catalog_book_id)
    if before_entry_id is not None:
        qs = qs.exclude(pk=before_entry_id)
    return not qs.exists()


def can_reveal_peer_viewpoint(user_book: UserBook) -> bool:
    """فقط یک‌بار، بعد از اتمام + ثبت دیدگاه پایانی خود کاربر."""
    return (
        user_book.status == BookStatus.FINISHED
        and user_has_final_viewpoint(user_book)
        and not user_book.peer_viewpoint_revealed
    )


def serialize_peer_viewpoint(entry: Entry, request=None) -> dict[str, Any]:
    user = entry.user_book.user
    display = ''
    if hasattr(user, 'get_display_label'):
        display = (user.get_display_label() or '').strip()
    if not display:
        display = getattr(user, 'username', '') or 'خواننده‌ای دیگر'

    audio_url = None
    if entry.audio:
        url = entry.audio.url
        audio_url = request.build_absolute_uri(url) if request else url

    return {
        'id': entry.pk,
        'media_type': entry.media_type,
        'text': sanitize_public_text(entry.text_content) if entry.media_type == EntryMediaType.TEXT else '',
        'audio_url': audio_url,
        'author_label': display[:80],
        'entry_date': entry.entry_date.isoformat() if entry.entry_date else None,
    }


def pick_random_peer_final_viewpoint(user_book: UserBook) -> Entry | None:
    ids = list(
        peer_final_queryset(user_book)
        .order_by('-created_at')
        .values_list('id', flat=True)[:PEER_POOL_LIMIT]
    )
    if not ids:
        return None
    chosen_id = random.choice(ids)
    return (
        Entry.objects.filter(pk=chosen_id)
        .select_related('user_book__user', 'user_book__book')
        .first()
    )


@transaction.atomic
def reveal_peer_final_viewpoint(user_book: UserBook) -> tuple[Entry | None, str]:
    """
    یک‌بار دیدگاه تصادفی دیگران را برمی‌گرداند و پرچم revealed را می‌زند.
    حتی اگر خالی باشد، فرصت یک‌باره مصرف می‌شود.
    """
    locked = UserBook.objects.select_for_update().get(pk=user_book.pk)
    if locked.status != BookStatus.FINISHED:
        return None, 'forbidden_not_finished'
    if not user_has_final_viewpoint(locked):
        return None, 'forbidden_no_final'
    if locked.peer_viewpoint_revealed:
        return None, 'already_revealed'

    peer = pick_random_peer_final_viewpoint(locked)
    locked.peer_viewpoint_revealed = True
    locked.save(update_fields=['peer_viewpoint_revealed', 'updated_at'])
    # همگام با نمونهٔ در حافظه
    user_book.peer_viewpoint_revealed = True
    return peer, 'ok' if peer else 'empty'


def get_social_status(user_book: UserBook) -> dict[str, Any]:
    finished = user_book.status == BookStatus.FINISHED
    has_final = user_has_final_viewpoint(user_book) if finished else False
    revealed = bool(user_book.peer_viewpoint_revealed)
    can_reveal = finished and has_final and not revealed
    peer_count = count_peer_final_viewpoints(user_book) if can_reveal else 0
    return {
        'has_final_viewpoint': has_final,
        'peer_revealed': revealed,
        'can_reveal_peer': can_reveal,
        'peer_available': can_reveal and peer_count > 0,
    }
