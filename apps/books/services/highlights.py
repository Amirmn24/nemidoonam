"""CRUD هایلایت — فقط متادیتا در DB؛ هیچ بایتی از PDF بازنویسی نمی‌شود."""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

from apps.books.models.document import UserBookDocument
from apps.books.models.highlight import (
    DEFAULT_HIGHLIGHT_COLOR,
    LEGACY_COLOR_HEX,
    DocumentHighlight,
)

MAX_RECTS = 48
MAX_QUOTE_LEN = 4000
MAX_NOTE_LEN = 500
_HEX_RE = re.compile(r'^#([0-9a-fA-F]{6})$')


def normalize_color(raw) -> str:
    value = (raw or '').strip()
    if value in LEGACY_COLOR_HEX:
        return LEGACY_COLOR_HEX[value]
    if not _HEX_RE.match(value):
        raise ValidationError({'color': 'رنگ باید به صورت #RRGGBB باشد.'})
    return value.lower()


def _as_unit(value, field: str) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field: 'مقدار نامعتبر است.'}) from exc
    if n < -0.02 or n > 1.02:
        raise ValidationError({field: 'مختصات باید بین ۰ و ۱ باشد.'})
    return max(0.0, min(1.0, n))


def normalize_rects(raw) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise ValidationError({'rects': 'حداقل یک محدوده لازم است.'})
    if len(raw) > MAX_RECTS:
        raise ValidationError({'rects': f'حداکثر {MAX_RECTS} محدوده مجاز است.'})
    cleaned = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValidationError({'rects': 'هر محدوده باید شیء باشد.'})
        x = _as_unit(item.get('x'), 'rects')
        y = _as_unit(item.get('y'), 'rects')
        w = _as_unit(item.get('w'), 'rects')
        h = _as_unit(item.get('h'), 'rects')
        if w < 0.002 or h < 0.002:
            continue
        cleaned.append(
            {
                'x': round(x, 6),
                'y': round(y, 6),
                'w': round(w, 6),
                'h': round(h, 6),
            }
        )
    if not cleaned:
        raise ValidationError({'rects': 'محدودهٔ انتخاب معتبر نیست.'})
    return cleaned


def serialize_highlight(hl: DocumentHighlight) -> dict:
    return {
        'id': hl.pk,
        'page_number': hl.page_number,
        'color': hl.color,
        'quote': hl.quote or '',
        'note': hl.note or '',
        'rects': hl.rects or [],
        'created_at': hl.created_at,
        'updated_at': hl.updated_at,
    }


def list_highlights(document: UserBookDocument) -> list[DocumentHighlight]:
    return list(document.highlights.all())


def create_highlight(
    document: UserBookDocument,
    *,
    page_number: int,
    rects,
    color: str = DEFAULT_HIGHLIGHT_COLOR,
    quote: str = '',
    note: str = '',
) -> DocumentHighlight:
    if page_number < 1:
        raise ValidationError({'page_number': 'شماره صفحه نامعتبر است.'})
    quote = (quote or '').strip()[:MAX_QUOTE_LEN]
    note = (note or '').strip()[:MAX_NOTE_LEN]
    return DocumentHighlight.objects.create(
        document=document,
        page_number=page_number,
        color=normalize_color(color or DEFAULT_HIGHLIGHT_COLOR),
        quote=quote,
        note=note,
        rects=normalize_rects(rects),
    )


def update_highlight(
    highlight: DocumentHighlight,
    *,
    color: str | None = None,
    note: str | None = None,
) -> DocumentHighlight:
    fields = ['updated_at']
    if color is not None:
        highlight.color = normalize_color(color)
        fields.append('color')
    if note is not None:
        highlight.note = (note or '').strip()[:MAX_NOTE_LEN]
        fields.append('note')
    if len(fields) > 1:
        highlight.save(update_fields=fields)
    return highlight


def delete_highlight(highlight: DocumentHighlight) -> None:
    highlight.delete()
