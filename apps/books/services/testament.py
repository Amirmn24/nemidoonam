"""وصیت کوتاه برای کتاب فیزیکی: ثبت یک‌باره و نمایش تصادفی هنگام شروع خواندن."""

from __future__ import annotations

import random
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from apps.books.models import BookStatus, BookTestament, ResourceKind, UserBook
from apps.books.services.social import sanitize_public_text

TESTAMENT_MAX_LEN = 160
TESTAMENT_MAX_LINES = 3
PEER_POOL_LIMIT = 250

# وضعیت‌هایی که خواننده می‌تواند وصیت بنویسد
_WRITABLE_STATUSES = frozenset(
    {
        BookStatus.READING,
        BookStatus.PAUSED,
        BookStatus.FINISHED,
    }
)


def is_physical_shelf(user_book: UserBook) -> bool:
    return user_book.book.resource_kind == ResourceKind.PHYSICAL


def normalize_testament_text(text: str) -> str:
    cleaned = sanitize_public_text(text, max_len=TESTAMENT_MAX_LEN)
    # خطوط خالی پشت‌سرهم و فاصله‌های اضافی را جمع می‌کنیم
    lines = [ln.strip() for ln in cleaned.split('\n')]
    lines = [ln for ln in lines if ln]
    return '\n'.join(lines)


def validate_testament_text(text: str) -> str:
    cleaned = normalize_testament_text(text)
    if not cleaned:
        raise ValueError('متن وصیت خالی است.')
    line_count = cleaned.count('\n') + 1
    if line_count > TESTAMENT_MAX_LINES:
        raise ValueError(f'وصیت حداکثر {TESTAMENT_MAX_LINES} خط می‌تواند باشد.')
    if len(cleaned) > TESTAMENT_MAX_LEN:
        raise ValueError(f'وصیت حداکثر {TESTAMENT_MAX_LEN} نویسه می‌تواند باشد.')
    return cleaned


def get_own_testament(user_book: UserBook) -> BookTestament | None:
    return getattr(user_book, 'testament', None) or BookTestament.objects.filter(
        user_book_id=user_book.pk
    ).first()


def can_write_testament(user_book: UserBook) -> bool:
    return (
        is_physical_shelf(user_book)
        and user_book.status in _WRITABLE_STATUSES
        and get_own_testament(user_book) is None
    )


def peer_testament_queryset(user_book: UserBook) -> QuerySet[BookTestament]:
    return (
        BookTestament.objects.filter(
            user_book__book_id=user_book.book_id,
            user_book__book__resource_kind=ResourceKind.PHYSICAL,
        )
        .exclude(user_book__user_id=user_book.user_id)
        .exclude(text='')
        .select_related('user_book__user', 'user_book__book')
    )


def pick_random_peer_testament(user_book: UserBook) -> BookTestament | None:
    ids = list(
        peer_testament_queryset(user_book)
        .order_by('-created_at')
        .values_list('id', flat=True)[:PEER_POOL_LIMIT]
    )
    if not ids:
        return None
    chosen_id = random.choice(ids)
    return (
        BookTestament.objects.filter(pk=chosen_id)
        .select_related('user_book__user', 'user_book__book')
        .first()
    )


def _author_label(user) -> str:
    display = ''
    if hasattr(user, 'get_display_label'):
        display = (user.get_display_label() or '').strip()
    if not display:
        display = getattr(user, 'username', '') or 'خواننده‌ای دیگر'
    return display[:80]


def serialize_testament(testament: BookTestament | None, *, include_author: bool = True) -> dict[str, Any] | None:
    if testament is None:
        return None
    payload: dict[str, Any] = {
        'id': testament.pk,
        'text': sanitize_public_text(testament.text, max_len=TESTAMENT_MAX_LEN),
        'created_at': testament.created_at.isoformat() if testament.created_at else None,
    }
    if include_author:
        payload['author_label'] = _author_label(testament.user_book.user)
    return payload


@transaction.atomic
def create_testament(user_book: UserBook, text: str) -> BookTestament:
    if not is_physical_shelf(user_book):
        raise ValueError('وصیت فقط برای کتاب فیزیکی است.')
    if user_book.status not in _WRITABLE_STATUSES:
        raise ValueError('برای ثبت وصیت باید کتاب را شروع کرده باشی.')
    if get_own_testament(user_book) is not None:
        raise ValueError('برای این کتاب قبلاً وصیت ثبت کرده‌ای.')

    cleaned = validate_testament_text(text)
    locked = UserBook.objects.select_for_update().get(pk=user_book.pk)
    if BookTestament.objects.filter(user_book_id=locked.pk).exists():
        raise ValueError('برای این کتاب قبلاً وصیت ثبت کرده‌ای.')

    try:
        testament = BookTestament.objects.create(user_book=locked, text=cleaned)
    except IntegrityError as exc:
        raise ValueError('برای این کتاب قبلاً وصیت ثبت کرده‌ای.') from exc
    return testament


@transaction.atomic
def reveal_peer_testament(user_book: UserBook) -> tuple[BookTestament | None, str]:
    """
    یک‌بار وصیت تصادفی دیگران را نشان می‌دهد و فرصت را مصرف می‌کند.
    حتی اگر استخر خالی باشد، پرچم revealed زده می‌شود تا اسپم/دوباره‌کشی نشود.
    """
    locked = UserBook.objects.select_for_update().select_related('book', 'revealed_peer_testament').get(
        pk=user_book.pk
    )
    if locked.book.resource_kind != ResourceKind.PHYSICAL:
        return None, 'forbidden_not_physical'
    if locked.status not in {BookStatus.READING, BookStatus.PAUSED, BookStatus.FINISHED}:
        return None, 'forbidden_not_reading'
    if locked.peer_testament_revealed:
        peer = locked.revealed_peer_testament
        if peer is not None:
            # بارگذاری مجدد با select_related برای سریالایز
            peer = (
                BookTestament.objects.filter(pk=peer.pk)
                .select_related('user_book__user')
                .first()
            )
        user_book.peer_testament_revealed = True
        user_book.revealed_peer_testament_id = locked.revealed_peer_testament_id
        return peer, 'already_revealed'

    peer = pick_random_peer_testament(locked)
    locked.peer_testament_revealed = True
    locked.revealed_peer_testament = peer
    locked.save(
        update_fields=['peer_testament_revealed', 'revealed_peer_testament', 'updated_at']
    )
    user_book.peer_testament_revealed = True
    user_book.revealed_peer_testament = peer
    return peer, 'ok' if peer else 'empty'


def get_testament_status(user_book: UserBook) -> dict[str, Any]:
    if not is_physical_shelf(user_book):
        return {
            'eligible': False,
            'has_own': False,
            'can_write': False,
            'own': None,
            'peer_revealed': False,
            'can_reveal_peer': False,
            'peer': None,
            'max_length': TESTAMENT_MAX_LEN,
            'max_lines': TESTAMENT_MAX_LINES,
        }

    own = get_own_testament(user_book)
    revealed = bool(user_book.peer_testament_revealed)
    peer = None
    if revealed and user_book.revealed_peer_testament_id:
        peer = (
            BookTestament.objects.filter(pk=user_book.revealed_peer_testament_id)
            .select_related('user_book__user')
            .first()
        )
    can_reveal = (
        user_book.status in {BookStatus.READING, BookStatus.PAUSED, BookStatus.FINISHED}
        and not revealed
    )
    return {
        'eligible': True,
        'has_own': own is not None,
        'can_write': can_write_testament(user_book),
        'own': serialize_testament(own, include_author=False),
        'peer_revealed': revealed,
        'can_reveal_peer': can_reveal,
        'peer': serialize_testament(peer, include_author=True) if peer else None,
        'max_length': TESTAMENT_MAX_LEN,
        'max_lines': TESTAMENT_MAX_LINES,
    }
