"""تحلیل وایب مطالعاتی با OpenAI — رادار شخصیت + نقل‌قول + لاگ تغییر."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from django.conf import settings
from django.db import transaction

from apps.books.models import ReadingVibeLog, ReadingVibeProfile, UserBook

logger = logging.getLogger(__name__)

VIBE_AXES: tuple[dict[str, str], ...] = (
    {'key': 'melancholy', 'label': 'غمگین'},
    {'key': 'wonder', 'label': 'شگفت‌زده'},
    {'key': 'intensity', 'label': 'پرتنش'},
    {'key': 'warmth', 'label': 'گرم'},
    {'key': 'intellect', 'label': 'اندیشه‌ورز'},
    {'key': 'escapism', 'label': 'خیال‌پرداز'},
)

AXIS_KEYS = tuple(item['key'] for item in VIBE_AXES)
AXIS_LABELS = {item['key']: item['label'] for item in VIBE_AXES}


def empty_axes() -> dict[str, int]:
    return {key: 0 for key in AXIS_KEYS}


def normalize_axes(raw: Any) -> dict[str, int]:
    source = raw if isinstance(raw, dict) else {}
    result: dict[str, int] = {}
    for key in AXIS_KEYS:
        try:
            value = int(round(float(source.get(key, 0))))
        except (TypeError, ValueError):
            value = 0
        result[key] = max(0, min(100, value))
    return result


def axes_for_chart(axes: dict[str, int] | None) -> list[dict[str, Any]]:
    data = normalize_axes(axes or {})
    return [
        {
            'key': item['key'],
            'label': item['label'],
            'value': data[item['key']],
        }
        for item in VIBE_AXES
    ]


def top_moods(axes: dict[str, int] | None, *, limit: int = 3) -> list[dict[str, Any]]:
    data = normalize_axes(axes or {})
    ranked = sorted(data.items(), key=lambda pair: pair[1], reverse=True)
    return [
        {'key': key, 'label': AXIS_LABELS[key], 'value': value}
        for key, value in ranked[:limit]
        if value > 0
    ]


def axis_deltas(
    previous: dict[str, int] | None,
    new: dict[str, int] | None,
) -> list[dict[str, Any]]:
    """تغییر هر محور نسبت به وایب قبلی (همهٔ لاگ‌ها در DB می‌مانند)."""
    prev = normalize_axes(previous or {})
    nxt = normalize_axes(new or {})
    deltas: list[dict[str, Any]] = []
    for key in AXIS_KEYS:
        delta = nxt[key] - prev[key]
        if delta == 0:
            continue
        deltas.append(
            {
                'key': key,
                'label': AXIS_LABELS[key],
                'from': prev[key],
                'to': nxt[key],
                'delta': delta,
            }
        )
    deltas.sort(key=lambda item: abs(item['delta']), reverse=True)
    return deltas


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or '').strip()
    if not text:
        raise ValueError('پاسخ خالی از مدل')
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[\s\S]*\}', text)
    if not match:
        raise ValueError('JSON معتبر در پاسخ مدل پیدا نشد')
    payload = json.loads(match.group(0))
    if not isinstance(payload, dict):
        raise ValueError('ساختار JSON نامعتبر')
    return payload


def _shelf_snapshot(user, *, limit: int = 18) -> list[dict[str, Any]]:
    rows = (
        UserBook.objects.filter(user=user)
        .select_related('book')
        .order_by('-created_at')[:limit]
    )
    return [
        {
            'title': row.book.title,
            'author': row.book.author,
            'status': row.get_status_display(),
            'notes': (row.notes or '')[:240],
        }
        for row in rows
    ]


def _call_openai(prompt_user: str) -> dict[str, Any]:
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY تنظیم نشده است.')

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    model = getattr(settings, 'OPENAI_VIBE_MODEL', 'gpt-4o-mini')
    system = (
        'تو تحلیل‌گر وایب مطالعاتی هستی، شبیه Spotify Wrapped برای کتاب‌خوان‌ها. '
        'همیشه فقط JSON معتبر برگردان. زبان خروجی فارسی روان و صمیمی است. '
        'محورها باید عدد صحیح ۰ تا ۱۰۰ باشند و مجموع‌شان لزوماً ۱۰۰ نیست '
        '(هر محور مستقل است مثل درصد شدت مود).'
    )
    response = client.chat.completions.create(
        model=model,
        temperature=0.7,
        response_format={'type': 'json_object'},
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt_user},
        ],
    )
    content = response.choices[0].message.content or ''
    return _extract_json(content)


def _heuristic_axes(title: str, author: str, previous: dict[str, int]) -> dict[str, int]:
    """اگر API در دسترس نباشد، تغییر ملایم روی وایب قبلی می‌سازد."""
    base = normalize_axes(previous) if any(previous.values()) else {
        'melancholy': 28,
        'wonder': 42,
        'intensity': 30,
        'warmth': 35,
        'intellect': 48,
        'escapism': 40,
    }
    seed = sum(ord(ch) for ch in f'{title}:{author}') or 1
    bumps = {
        'melancholy': (seed % 17) - 5,
        'wonder': ((seed // 3) % 19) - 6,
        'intensity': ((seed // 5) % 15) - 4,
        'warmth': ((seed // 7) % 13) - 3,
        'intellect': ((seed // 11) % 21) - 7,
        'escapism': ((seed // 13) % 17) - 5,
    }
    return normalize_axes({key: base[key] + bumps[key] for key in AXIS_KEYS})


def analyze_vibe_with_ai(
    *,
    new_book_title: str,
    new_book_author: str,
    previous_axes: dict[str, int],
    previous_quote: str,
    shelf: list[dict[str, Any]],
) -> dict[str, Any]:
    axis_help = ', '.join(f'{item["key"]} ({item["label"]})' for item in VIBE_AXES)
    prompt = (
        'بر اساس قفسهٔ کاربر و کتاب تازه‌اضافه‌شده، وایب مطالعاتی جدید بساز.\n\n'
        f'کتاب جدید: «{new_book_title}» اثر {new_book_author}\n'
        f'وایـب قبلی (axes): {json.dumps(normalize_axes(previous_axes), ensure_ascii=False)}\n'
        f'نقل‌قول قبلی: {previous_quote or "—"}\n'
        f'قفسهٔ اخیر: {json.dumps(shelf, ensure_ascii=False)}\n\n'
        f'محورها: {axis_help}\n\n'
        'خروجی دقیقاً این شکل JSON:\n'
        '{\n'
        '  "axes": {"melancholy":0,"wonder":0,"intensity":0,"warmth":0,"intellect":0,"escapism":0},\n'
        '  "quote": "یک جملهٔ کوتاه وایب مثل اسپاتیفای",\n'
        '  "mood_label": "برچسب کوتاه مود مثل غمگینِ اندیشه‌ورز",\n'
        '  "change_summary": "۲–۳ جمله که بگوید نسبت به قبل چه تغییری کرده و کتاب جدید چه اثری داشته"\n'
        '}\n'
        'اگر وایب قبلی صفر بود، change_summary را به‌صورت شروع مسیر بنویس.'
    )
    try:
        raw = _call_openai(prompt)
        axes = normalize_axes(raw.get('axes'))
        quote = str(raw.get('quote') or '').strip()
        mood_label = str(raw.get('mood_label') or '').strip()
        change_summary = str(raw.get('change_summary') or '').strip()
        if not quote:
            tops = top_moods(axes, limit=2)
            mood_bits = ' و '.join(f'{m["value"]}٪ {m["label"]}' for m in tops) or 'خنثی'
            quote = f'وایـب فعلی‌ات: {mood_bits}.'
        if not mood_label:
            tops = top_moods(axes, limit=2)
            mood_label = ' · '.join(m['label'] for m in tops) or 'در حال شکل‌گیری'
        if not change_summary:
            change_summary = (
                f'با افزودن «{new_book_title}» وایب مطالعاتی‌ات تازه شد.'
            )
        return {
            'axes': axes,
            'quote': quote,
            'mood_label': mood_label,
            'change_summary': change_summary,
            'source': 'openai',
        }
    except Exception:
        logger.exception('تحلیل OpenAI برای وایب ناموفق بود؛ از heuristic استفاده می‌شود.')
        axes = _heuristic_axes(new_book_title, new_book_author, previous_axes)
        tops = top_moods(axes, limit=2)
        mood_bits = ' و '.join(f'{m["value"]}٪ {m["label"]}' for m in tops)
        had_previous = any(normalize_axes(previous_axes).values())
        change_summary = (
            f'بعد از «{new_book_title}» تعادل مودها جابه‌جا شد → {mood_bits}.'
            if had_previous
            else f'شروع مسیر با «{new_book_title}»؛ وایب اولیه شکل گرفت → {mood_bits}.'
        )
        return {
            'axes': axes,
            'quote': f'الان فضای مطالعه‌ات بیشتر {mood_bits} به نظر می‌رسد.',
            'mood_label': ' · '.join(m['label'] for m in tops) or 'در حال شکل‌گیری',
            'change_summary': change_summary,
            'source': 'heuristic',
        }


@transaction.atomic
def update_user_vibe_from_user_book(user_book: UserBook) -> ReadingVibeProfile:
    user = user_book.user
    profile, _ = ReadingVibeProfile.objects.select_for_update().get_or_create(user=user)
    previous_axes = normalize_axes(profile.axes)
    previous_quote = profile.quote or ''

    analysis = analyze_vibe_with_ai(
        new_book_title=user_book.book.title,
        new_book_author=user_book.book.author,
        previous_axes=previous_axes,
        previous_quote=previous_quote,
        shelf=_shelf_snapshot(user),
    )

    profile.axes = analysis['axes']
    profile.quote = analysis['quote']
    profile.mood_label = analysis['mood_label']
    profile.save(update_fields=['axes', 'quote', 'mood_label', 'updated_at'])

    ReadingVibeLog.objects.create(
        user=user,
        user_book=user_book,
        book_title=user_book.book.title,
        book_author=user_book.book.author,
        previous_axes=previous_axes,
        new_axes=analysis['axes'],
        quote=analysis['quote'],
        mood_label=analysis['mood_label'],
        change_summary=analysis['change_summary'],
    )
    return profile


def get_vibe_dashboard_payload(user) -> dict[str, Any]:
    profile = (
        ReadingVibeProfile.objects.filter(user=user).only(
            'axes', 'quote', 'mood_label', 'updated_at'
        ).first()
    )
    # همهٔ لاگ‌ها در DB می‌مانند؛ فقط ۵تای آخر برای UI
    logs = (
        ReadingVibeLog.objects.filter(user=user)
        .only(
            'book_title',
            'book_author',
            'previous_axes',
            'new_axes',
            'quote',
            'mood_label',
            'change_summary',
            'created_at',
        )[:5]
    )

    if not profile:
        shelf_count = UserBook.objects.filter(user=user).count()
        return {
            'status': 'empty' if shelf_count == 0 else 'pending',
            'axes': axes_for_chart(empty_axes()),
            'quote': '',
            'mood_label': '',
            'top_moods': [],
            'updated_at': None,
            'changelog': [],
            'shelf_count': shelf_count,
        }

    axes = normalize_axes(profile.axes)
    return {
        'status': 'ready',
        'axes': axes_for_chart(axes),
        'quote': profile.quote,
        'mood_label': profile.mood_label,
        'top_moods': top_moods(axes),
        'updated_at': profile.updated_at.isoformat() if profile.updated_at else None,
        'changelog': [
            {
                'id': log.id,
                'book_title': log.book_title,
                'book_author': log.book_author,
                'quote': log.quote,
                'mood_label': log.mood_label,
                'change_summary': log.change_summary,
                'deltas': axis_deltas(log.previous_axes, log.new_axes),
                'previous_axes': axes_for_chart(log.previous_axes),
                'new_axes': axes_for_chart(log.new_axes),
                'created_at': log.created_at.isoformat(),
            }
            for log in logs
        ],
        'shelf_count': UserBook.objects.filter(user=user).count(),
    }


def enqueue_vibe_update(user_book_id: int) -> None:
    from emails.services.queue import enqueue

    from apps.books.tasks import analyze_reading_vibe_task

    enqueue(analyze_reading_vibe_task, user_book_id)
