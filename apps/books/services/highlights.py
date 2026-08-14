"""CRUD هایلایت — فقط متادیتا در DB؛ هیچ بایتی از PDF بازنویسی نمی‌شود."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.books.models.document import UserBookDocument
from apps.books.models.highlight import HIGHLIGHT_COLOR_VALUES, DocumentHighlight

MAX_RECTS = 48
MAX_QUOTE_LEN = 4000


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
    color: str = 'yellow',
    quote: str = '',
) -> DocumentHighlight:
    if page_number < 1:
        raise ValidationError({'page_number': 'شماره صفحه نامعتبر است.'})
    color = (color or 'yellow').strip()
    if color not in HIGHLIGHT_COLOR_VALUES:
        raise ValidationError({'color': 'رنگ نامعتبر است.'})
    quote = (quote or '').strip()[:MAX_QUOTE_LEN]
    return DocumentHighlight.objects.create(
        document=document,
        page_number=page_number,
        color=color,
        quote=quote,
        rects=normalize_rects(rects),
    )


def update_highlight(
    highlight: DocumentHighlight,
    *,
    color: str | None = None,
) -> DocumentHighlight:
    if color is not None:
        color = color.strip()
        if color not in HIGHLIGHT_COLOR_VALUES:
            raise ValidationError({'color': 'رنگ نامعتبر است.'})
        highlight.color = color
        highlight.save(update_fields=['color', 'updated_at'])
    return highlight


def delete_highlight(highlight: DocumentHighlight) -> None:
    highlight.delete()
