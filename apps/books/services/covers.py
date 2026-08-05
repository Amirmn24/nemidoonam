"""جست‌وجوی خودکار جلد کتاب از چند منبع (Open Library / Wikipedia / Google / GPT hint)."""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction

logger = logging.getLogger(__name__)

OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json'
GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'
USER_AGENT = 'NemidoonamBookCoverBot/1.0 (reading-app; cover-lookup)'


def _http_get_json(url: str, *, timeout: float = 15.0) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode('utf-8', errors='replace')
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _http_get_bytes(url: str, *, timeout: float = 20.0) -> tuple[bytes, str]:
    if url.startswith('http://'):
        url = 'https://' + url[len('http://') :]
    # ویکی‌مدیا گاهی query اضافه می‌کند
    url = url.split('?utm_')[0]
    request = urllib.request.Request(
        url,
        headers={'User-Agent': USER_AGENT, 'Accept': 'image/*,*/*'},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        content_type = (response.headers.get('Content-Type') or '').split(';')[0].strip()
        return response.read(), content_type


def _open_library_cover_from_docs(docs: list[dict[str, Any]]) -> str:
    for doc in docs:
        cover_i = doc.get('cover_i')
        if cover_i:
            return f'https://covers.openlibrary.org/b/id/{cover_i}-L.jpg'
        for isbn in doc.get('isbn') or []:
            if isbn:
                return f'https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg'
        for edition in doc.get('edition_key') or []:
            if edition:
                return f'https://covers.openlibrary.org/b/olid/{edition}-L.jpg'
    return ''


def _search_open_library(params: dict[str, str]) -> str:
    query = {
        **params,
        'limit': params.get('limit', '8'),
        'fields': 'key,title,author_name,cover_i,isbn,edition_key',
    }
    url = f'{OPEN_LIBRARY_SEARCH}?{urllib.parse.urlencode(query)}'
    try:
        payload = _http_get_json(url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
        logger.warning('Open Library ناموفق (%s): %s', params, exc)
        return ''
    return _open_library_cover_from_docs(list(payload.get('docs') or []))


def find_open_library_cover_url(title: str, author: str) -> str:
    title = (title or '').strip()
    author = (author or '').strip()
    if not title:
        return ''

    attempts: list[dict[str, str]] = []
    if author:
        attempts.append({'title': title, 'author': author})
        attempts.append({'q': f'{title} {author}'})
    attempts.append({'title': title})
    attempts.append({'q': title})

    seen: set[str] = set()
    for params in attempts:
        key = urllib.parse.urlencode(params)
        if key in seen:
            continue
        seen.add(key)
        url = _search_open_library(params)
        if url:
            return url
    return ''


def find_wikipedia_cover_url(title: str, author: str) -> str:
    """برای کتاب‌های فارسی معروف، تصویر صفحهٔ ویکی‌پدیا اغلب همان جلد است."""
    title = (title or '').strip()
    author = (author or '').strip()
    if not title:
        return ''

    for lang in ('fa', 'en'):
        search_q = f'{title} {author}'.strip()
        search_url = (
            f'https://{lang}.wikipedia.org/w/api.php?'
            + urllib.parse.urlencode(
                {
                    'action': 'query',
                    'list': 'search',
                    'srsearch': search_q,
                    'format': 'json',
                    'srlimit': '8',
                }
            )
        )
        try:
            payload = _http_get_json(search_url)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
            logger.warning('Wikipedia search (%s) ناموفق: %s', lang, exc)
            continue

        hits = list((payload.get('query') or {}).get('search') or [])
        if not hits:
            continue

        # اولویت: عنوان دقیق کتاب، بعد صفحه‌هایی که عنوان کتاب را دارند (نه فقط نویسنده)
        def rank(item: dict[str, Any]) -> tuple[int, int]:
            page_title = (item.get('title') or '').strip()
            if page_title == title:
                return (0, 0)
            if title in page_title:
                return (1, abs(len(page_title) - len(title)))
            if author and page_title == author:
                return (9, 0)
            return (5, abs(len(page_title) - len(title)))

        hits.sort(key=rank)
        candidates = [h.get('title') for h in hits[:4] if h.get('title')]
        if title not in candidates:
            candidates.insert(0, title)

        for page_title in candidates:
            img_url = (
                f'https://{lang}.wikipedia.org/w/api.php?'
                + urllib.parse.urlencode(
                    {
                        'action': 'query',
                        'titles': page_title,
                        'prop': 'pageimages',
                        'format': 'json',
                        'pithumbsize': '800',
                        'piprop': 'thumbnail',
                    }
                )
            )
            try:
                img_payload = _http_get_json(img_url)
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
                continue
            pages = (img_payload.get('query') or {}).get('pages') or {}
            for page in pages.values():
                if page.get('missing') is not None or int(page.get('ns', 0)) != 0:
                    continue
                # صفحهٔ نویسنده را رد کن
                if author and (page.get('title') or '').strip() == author:
                    continue
                thumb = (page.get('thumbnail') or {}).get('source')
                if thumb:
                    return str(thumb)
    return ''


def find_google_books_cover_url(title: str, author: str) -> str:
    api_key = getattr(settings, 'GOOGLE_BOOKS_API_KEY', '') or ''
    if not api_key:
        # بدون key معمولاً 403/429 می‌دهد؛ بی‌خودی صدا نزن
        return ''

    title = (title or '').strip()
    author = (author or '').strip()
    if not title:
        return ''

    params: dict[str, str] = {
        'q': f'{title} {author}'.strip(),
        'maxResults': '8',
        'printType': 'books',
        'key': api_key,
    }
    url = f'{GOOGLE_BOOKS_URL}?{urllib.parse.urlencode(params)}'
    try:
        payload = _http_get_json(url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
        logger.warning('Google Books ناموفق: %s', exc)
        return ''

    for item in payload.get('items') or []:
        links = ((item.get('volumeInfo') or {}).get('imageLinks')) or {}
        for key in ('extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'):
            image = links.get(key)
            if image:
                return str(image).replace('zoom=1', 'zoom=2')
    return ''


def _latin_search_hint_via_openai(title: str, author: str) -> str:
    """برای کتاب‌های فارسی، یک کوئری لاتین مناسب Open Library می‌سازد."""
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
    if not api_key:
        return ''
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning('پکیج openai نصب نیست؛ hint لاتین جلد رد شد.')
        return ''

    model = getattr(settings, 'OPENAI_VIBE_MODEL', 'gpt-4o-mini')
    client = OpenAI(api_key=api_key)
    prompt = (
        'برای پیدا کردن جلد کتاب در Open Library، یک کوئری لاتین/انگلیسی کوتاه بده. '
        'فقط JSON برگردان مثل {"query":"Sal-e Balva Abbas Maroufi"}.\n'
        f'title: {title}\nauthor: {author}'
    )
    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0.2,
            response_format={'type': 'json_object'},
            messages=[
                {
                    'role': 'system',
                    'content': 'You help find Latin/English book search queries for Open Library. JSON only.',
                },
                {'role': 'user', 'content': prompt},
            ],
        )
        content = response.choices[0].message.content or '{}'
        data = json.loads(content)
        query = str(data.get('query') or '').strip()
        return query
    except Exception as exc:
        logger.warning('ساخت کوئری لاتین جلد ناموفق: %s', exc)
        return ''


def find_cover_url(title: str, author: str) -> str:
    title = (title or '').strip()
    author = (author or '').strip()

    for finder, label in (
        (find_open_library_cover_url, 'openlibrary'),
        (find_wikipedia_cover_url, 'wikipedia'),
        (find_google_books_cover_url, 'google'),
    ):
        url = finder(title, author)
        if url:
            logger.info('جلد از %s پیدا شد.', label)
            return url

    # کتاب‌های فارسی اغلب فقط با عنوان لاتین در Open Library هستند
    hint = _latin_search_hint_via_openai(title, author)
    if hint:
        url = _search_open_library({'q': hint})
        if url:
            logger.info('جلد با hint لاتین Open Library پیدا شد: %s', hint)
            return url
        # اگر query شبیه "Title Author" بود، جدا هم امتحان کن
        parts = hint.split()
        if len(parts) >= 2:
            url = _search_open_library({'title': ' '.join(parts[:-1]), 'author': parts[-1]})
            if url:
                return url

    return ''


def _extension_for(content_type: str, url: str) -> str:
    mapping = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    }
    if content_type in mapping:
        return mapping[content_type]
    match = re.search(r'\.(jpe?g|png|webp|gif)(?:\?|$)', url, re.I)
    if match:
        ext = match.group(1).lower()
        return 'jpg' if ext == 'jpeg' else ext
    return 'jpg'


def attach_cover_from_url(book, image_url: str) -> bool:
    if not image_url:
        return False
    book.refresh_from_db(fields=['cover'])
    if book.cover:
        return False
    try:
        data, content_type = _http_get_bytes(image_url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        logger.warning('دانلود جلد کتاب %s ناموفق: %s', book.pk, exc)
        return False
    if not data or len(data) < 1500:
        logger.info('فایل جلد برای کتاب %s خیلی کوچک/خالی بود.', book.pk)
        return False

    book.refresh_from_db(fields=['cover'])
    if book.cover:
        return False

    ext = _extension_for(content_type, image_url)
    safe_stem = re.sub(r'[^\w\-]+', '-', f'{book.title}-{book.author}')[:60].strip('-') or 'cover'
    filename = f'{safe_stem}-{book.pk}.{ext}'
    book.cover.save(filename, ContentFile(data), save=True)
    return True


@transaction.atomic
def fetch_and_set_book_cover(book_id: int) -> bool:
    from apps.books.models import Book

    try:
        book = Book.objects.select_for_update().get(pk=book_id)
    except Book.DoesNotExist:
        return False
    if book.cover:
        return False

    image_url = find_cover_url(book.title, book.author)
    if not image_url:
        logger.info('جلدی برای «%s — %s» پیدا نشد.', book.title, book.author)
        return False
    ok = attach_cover_from_url(book, image_url)
    if ok:
        logger.info('جلد کتاب %s ست شد.', book.pk)
    return ok


def enqueue_cover_fetch(book_id: int) -> None:
    from emails.services.queue import enqueue

    from apps.books.tasks import fetch_book_cover_task

    enqueue(fetch_book_cover_task, book_id)
