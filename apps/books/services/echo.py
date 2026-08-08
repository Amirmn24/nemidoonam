"""پژواک شبانه: یک یادداشت عمومی تصادفی در پنجرهٔ ۲۰:۰۰–۰۸:۰۰، یک‌بار در هر شب."""

from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.books.models import BookStatus, Entry, EntryKind, EntryMediaType, UserBook
from apps.books.models.echo import EchoClaim
from apps.books.services.catalog import add_book_to_shelf
from apps.books.services.social import sanitize_public_text

ECHO_WINDOW_START = time(20, 0)  # ۲۰:۰۰
ECHO_WINDOW_END = time(8, 0)  # ۰۸:۰۰
ECHO_POOL_LIMIT = 400
SHAREABLE_KINDS = (
    EntryKind.VIEWPOINT,
    EntryKind.FEELING,
    EntryKind.BOOK_TEXT,
)


def echo_now(now: datetime | None = None) -> datetime:
    return timezone.localtime(now) if now else timezone.localtime()


def is_echo_window_open(now: datetime | None = None) -> bool:
    local = echo_now(now)
    t = local.time()
    return t >= ECHO_WINDOW_START or t < ECHO_WINDOW_END


def echo_night_key(now: datetime | None = None) -> date:
    """شب از ۲۰:۰۰ روز D تا ۰۸:۰۰ روز D+۱ با کلید D شناخته می‌شود."""
    local = echo_now(now)
    if local.time() < ECHO_WINDOW_END:
        return (local - timedelta(days=1)).date()
    return local.date()


def public_echo_queryset(*, exclude_user_id: int | None = None) -> QuerySet[Entry]:
    qs = (
        Entry.objects.filter(
            is_public=True,
            is_sealed=False,
            kind__in=SHAREABLE_KINDS,
            media_type__in=[EntryMediaType.TEXT, EntryMediaType.VOICE],
        )
        .filter(
            Q(media_type=EntryMediaType.TEXT, text_content__gt='')
            | (
                Q(media_type=EntryMediaType.VOICE)
                & ~Q(audio='')
                & Q(audio__isnull=False)
            )
        )
        .select_related('user_book__user', 'user_book__book')
    )
    if exclude_user_id is not None:
        qs = qs.exclude(user_book__user_id=exclude_user_id)
    return qs


def pick_random_echo_entry(*, exclude_user_id: int) -> Entry | None:
    ids = list(
        public_echo_queryset(exclude_user_id=exclude_user_id)
        .order_by('-created_at')
        .values_list('id', flat=True)[:ECHO_POOL_LIMIT]
    )
    if not ids:
        return None
    chosen_id = random.choice(ids)
    return (
        Entry.objects.filter(pk=chosen_id)
        .select_related('user_book__user', 'user_book__book')
        .first()
    )


def serialize_echo_content(entry: Entry, request=None, *, reveal_book: bool = False) -> dict[str, Any]:
    """محتوای امن برای کلاینت؛ عنوان کتاب فقط بعد از reveal."""
    payload: dict[str, Any] = {
        'kind': entry.kind,
        'media_type': entry.media_type,
        'text': '',
        'audio_url': None,
    }
    if entry.media_type == EntryMediaType.TEXT:
        payload['text'] = sanitize_public_text(entry.text_content)
    elif entry.media_type == EntryMediaType.VOICE and entry.audio:
        url = entry.audio.url
        payload['audio_url'] = request.build_absolute_uri(url) if request else url

    if reveal_book:
        book = entry.user_book.book
        cover = book.cover
        cover_url = None
        if cover:
            cover_url = request.build_absolute_uri(cover.url) if request else cover.url
        payload['book'] = {
            'catalog_id': book.pk,
            'title': book.title,
            'author': book.author,
            'cover_url': cover_url,
            'total_pages': book.total_pages,
        }
    else:
        payload['book'] = None
    return payload


def serialize_echo_claim(claim: EchoClaim, request=None, *, user=None) -> dict[str, Any]:
    entry = claim.entry
    reveal = bool(claim.book_revealed)
    data = {
        'token': str(claim.token),
        'night_key': claim.night_key.isoformat(),
        'book_revealed': reveal,
        'resolution': claim.resolution,
        'content': serialize_echo_content(entry, request, reveal_book=reveal),
        'already_on_shelf': False,
        'shelf_id': None,
    }
    if reveal and user is not None:
        shelf = UserBook.objects.filter(user=user, book_id=entry.user_book.book_id).first()
        if shelf:
            data['already_on_shelf'] = True
            data['shelf_id'] = shelf.pk
    return data


def get_echo_status(user, request=None) -> dict[str, Any]:
    now = echo_now()
    active = is_echo_window_open(now)
    night = echo_night_key(now)
    claim = (
        EchoClaim.objects.filter(user=user, night_key=night)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .first()
    )
    used = claim is not None
    open_claim = (
        claim
        if claim and claim.resolution == EchoClaim.Resolution.OPEN
        else None
    )
    # اگر شب عوض شده ولی پژواک باز مانده، هنوز قابل اتمام باشد
    if open_claim is None:
        open_claim = (
            EchoClaim.objects.filter(user=user, resolution=EchoClaim.Resolution.OPEN)
            .select_related('entry__user_book__user', 'entry__user_book__book')
            .order_by('-created_at')
            .first()
        )
    return {
        'active': active,
        'used_tonight': used,
        'can_draw': active and not used,
        'window': {
            'start': ECHO_WINDOW_START.strftime('%H:%M'),
            'end': ECHO_WINDOW_END.strftime('%H:%M'),
            'night_key': night.isoformat(),
        },
        'claim': serialize_echo_claim(open_claim, request, user=user) if open_claim else None,
    }


@transaction.atomic
def draw_echo(user, request=None) -> tuple[EchoClaim | None, str]:
    if not is_echo_window_open():
        return None, 'window_closed'

    night = echo_night_key()
    existing = (
        EchoClaim.objects.select_for_update()
        .filter(user=user, night_key=night)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .first()
    )
    if existing:
        if existing.resolution == EchoClaim.Resolution.OPEN:
            return existing, 'already_open'
        return existing, 'already_used'

    entry = pick_random_echo_entry(exclude_user_id=user.pk)
    if not entry:
        return None, 'empty'

    try:
        with transaction.atomic():
            claim = EchoClaim.objects.create(
                user=user,
                night_key=night,
                entry=entry,
            )
    except IntegrityError:
        claim = (
            EchoClaim.objects.filter(user=user, night_key=night)
            .select_related('entry__user_book__user', 'entry__user_book__book')
            .first()
        )
        if not claim:
            return None, 'error'
        if claim.resolution == EchoClaim.Resolution.OPEN:
            return claim, 'already_open'
        return claim, 'already_used'

    claim = (
        EchoClaim.objects.filter(pk=claim.pk)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .get()
    )
    return claim, 'ok'


def get_user_echo_claim(user, token) -> EchoClaim | None:
    return (
        EchoClaim.objects.filter(user=user, token=token)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .first()
    )


@transaction.atomic
def reveal_echo_book(claim: EchoClaim) -> EchoClaim:
    locked = EchoClaim.objects.select_for_update().get(pk=claim.pk)
    if not locked.book_revealed:
        locked.book_revealed = True
        locked.save(update_fields=['book_revealed', 'updated_at'])
    return (
        EchoClaim.objects.filter(pk=locked.pk)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .get()
    )


@transaction.atomic
def dismiss_echo(claim: EchoClaim) -> EchoClaim:
    locked = EchoClaim.objects.select_for_update().get(pk=claim.pk)
    if locked.resolution == EchoClaim.Resolution.OPEN:
        locked.resolution = EchoClaim.Resolution.DISMISSED
        locked.save(update_fields=['resolution', 'updated_at'])
    return locked


@transaction.atomic
def save_echo_to_shelf(claim: EchoClaim, user) -> tuple[EchoClaim, UserBook, bool]:
    locked = EchoClaim.objects.select_for_update().select_related(
        'entry__user_book__book'
    ).get(pk=claim.pk)
    if not locked.book_revealed:
        locked.book_revealed = True
    locked.resolution = EchoClaim.Resolution.SAVED
    locked.save(update_fields=['book_revealed', 'resolution', 'updated_at'])

    book = locked.entry.user_book.book
    user_book, created = add_book_to_shelf(
        user,
        book,
        status=BookStatus.WANT_TO_READ,
    )
    locked = (
        EchoClaim.objects.filter(pk=locked.pk)
        .select_related('entry__user_book__user', 'entry__user_book__book')
        .get()
    )
    return locked, user_book, created


def can_make_entry_public(entry: Entry) -> tuple[bool, str]:
    if entry.kind not in (
        EntryKind.VIEWPOINT,
        EntryKind.FEELING,
        EntryKind.BOOK_TEXT,
        EntryKind.FINAL_VIEWPOINT,
    ):
        return False, 'این نوع یادداشت قابل عمومی‌سازی نیست.'
    if entry.is_sealed:
        return False, 'یادداشت مهروموم را نمی‌توان عمومی کرد؛ اول مهر را بردار.'
    if entry.kind == EntryKind.FINAL_VIEWPOINT:
        return True, ''
    if entry.media_type == EntryMediaType.TEXT and not (entry.text_content or '').strip():
        return False, 'برای عمومی‌سازی، متن لازم است.'
    if entry.media_type == EntryMediaType.VOICE and not entry.audio:
        return False, 'برای عمومی‌سازی ویس، فایل صوتی لازم است.'
    if entry.media_type == EntryMediaType.IMAGE and not entry.image:
        return False, 'برای عمومی‌سازی تصویر، فایل لازم است.'
    return True, ''


@transaction.atomic
def publish_entry_with_consent(entry: Entry, *, confirm: bool) -> Entry:
    if not confirm:
        raise ValueError('برای عمومی‌سازی باید رضایت را تأیید کنی.')
    ok, reason = can_make_entry_public(entry)
    if not ok:
        raise ValueError(reason)
    if entry.is_public:
        return entry
    locked = Entry.objects.select_for_update().get(pk=entry.pk)
    if locked.is_public:
        return locked
    ok, reason = can_make_entry_public(locked)
    if not ok:
        raise ValueError(reason)
    locked.is_public = True
    if locked.media_type == EntryMediaType.TEXT:
        locked.text_content = sanitize_public_text(locked.text_content)
    locked.save(update_fields=['is_public', 'text_content', 'updated_at'])
    return locked
