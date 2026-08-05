"""جست‌وجوی خودکار جلد چاپ ایران — اولویت با فروشگاه‌های ایرانی (Digikala)."""

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

from apps.books.services.matching import fingerprint, text_similarity

logger = logging.getLogger(__name__)

DIGIKALA_SEARCH = 'https://api.digikala.com/v1/search/'
GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)

_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _http_get_json(url: str, *, timeout: float = 18.0, referer: str = '') -> dict[str, Any]:
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
    }
    if referer:
        headers['Referer'] = referer
    request = urllib.request.Request(url, headers=headers)
    with _OPENER.open(request, timeout=timeout) as response:
        raw = response.read().decode('utf-8', errors='replace')
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _http_get_bytes(url: str, *, timeout: float = 20.0) -> tuple[bytes, str]:
    if url.startswith('http://'):
        url = 'https://' + url[len('http://') :]
    request = urllib.request.Request(
        url,
        headers={'User-Agent': USER_AGENT, 'Accept': 'image/*,*/*'},
    )
    with _OPENER.open(request, timeout=timeout) as response:
        content_type = (response.headers.get('Content-Type') or '').split(';')[0].strip()
        return response.read(), content_type


def _larger_digikala_image(url: str) -> str:
    """thumbnail ۳۰۰px را به نسخهٔ بزرگ‌تر تبدیل می‌کند."""
    if not url:
        return ''
    return (
        url.replace(',h_300,w_300', ',h_800,w_800')
        .replace('h_300,w_300', 'h_800,w_800')
        .replace(',h_200,w_200', ',h_800,w_800')
    )


def _extract_digikala_image(product: dict[str, Any]) -> str:
    images = product.get('images') or {}
    main = images.get('main')
    candidates: list[str] = []
    if isinstance(main, dict):
        for key in ('url', 'webp_url'):
            value = main.get(key)
            if isinstance(value, list):
                candidates.extend(str(item) for item in value if item)
            elif isinstance(value, str) and value:
                candidates.append(value)
    elif isinstance(main, list):
        for item in main:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict) and item.get('url'):
                candidates.append(str(item['url']))
    elif isinstance(main, str):
        candidates.append(main)

    for default in images.get('default') or []:
        if isinstance(default, str):
            candidates.append(default)

    if not candidates:
        return ''
    # آخرین آیتم معمولاً کیفیت بهتری دارد
    return _larger_digikala_image(candidates[-1])


def _is_iranian_book_match(title: str, author: str, product_title: str) -> bool:
    """فقط وقتی عنوان کتاب (و نویسنده در صورت وجود) در عنوان محصول ایرانی دیده شود."""
    product_title = (product_title or '').strip()
    if not product_title:
        return False

    fp_title = fingerprint(title)
    fp_author = fingerprint(author)
    fp_product = fingerprint(product_title)
    if not fp_title or len(fp_title) < 3:
        return False

    title_ok = fp_title in fp_product or text_similarity(title, product_title) >= 0.62
    if not title_ok:
        return False

    if fp_author and len(fp_author) >= 3:
        author_ok = fp_author in fp_product or text_similarity(author, product_title) >= 0.5
        if not author_ok:
            return False

    # رد کردن لوازم جانبی/غیرکتاب اگر عنوان محصول خیلی بی‌ربط باشد
    junk = ('شارژر', 'کاور گوشی', 'قاب', 'لوازم', 'هدفون')
    if any(word in product_title for word in junk) and 'کتاب' not in product_title:
        return False
    return True


def find_digikala_cover_url(title: str, author: str) -> str:
    title = (title or '').strip()
    author = (author or '').strip()
    if not title:
        return ''

    queries = [
        f'کتاب {title} {author}'.strip(),
        f'{title} {author}'.strip(),
        f'کتاب {title}'.strip(),
    ]
    seen_q: set[str] = set()
    best_url = ''
    best_score = 0.0

    for query in queries:
        if not query or query in seen_q:
            continue
        seen_q.add(query)
        url = f'{DIGIKALA_SEARCH}?{urllib.parse.urlencode({"q": query})}'
        try:
            payload = _http_get_json(url, referer='https://www.digikala.com/')
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
            logger.warning('جست‌وجوی دیجی‌کالا ناموفق: %s', exc)
            continue

        products = list(((payload.get('data') or {}).get('products')) or [])
        for product in products[:12]:
            product_title = str(product.get('title_fa') or product.get('title_en') or '')
            if not _is_iranian_book_match(title, author, product_title):
                continue
            image_url = _extract_digikala_image(product)
            if not image_url:
                continue
            score = text_similarity(title, product_title)
            if author:
                score = (score * 0.7) + (text_similarity(author, product_title) * 0.3)
            if score > best_score:
                best_score = score
                best_url = image_url

        if best_url and best_score >= 0.55:
            break

    if best_url:
        logger.info('جلد ایرانی از دیجی‌کالا پیدا شد (score=%.2f).', best_score)
    return best_url


def find_google_books_fa_cover_url(title: str, author: str) -> str:
    """فقط اگر API key باشد؛ با فیلتر زبان فارسی برای نزدیک‌شدن به چاپ ایران."""
    api_key = getattr(settings, 'GOOGLE_BOOKS_API_KEY', '') or ''
    if not api_key:
        return ''

    title = (title or '').strip()
    author = (author or '').strip()
    if not title:
        return ''

    params = {
        'q': f'intitle:{title}' + (f'+inauthor:{author}' if author else ''),
        'maxResults': '10',
        'printType': 'books',
        'langRestrict': 'fa',
        'key': api_key,
    }
    url = f'{GOOGLE_BOOKS_URL}?{urllib.parse.urlencode(params)}'
    try:
        payload = _http_get_json(url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
        logger.warning('Google Books ناموفق: %s', exc)
        return ''

    for item in payload.get('items') or []:
        info = item.get('volumeInfo') or {}
        item_title = str(info.get('title') or '')
        authors = ' '.join(info.get('authors') or [])
        if not _is_iranian_book_match(title, author, f'{item_title} {authors}'):
            continue
        links = info.get('imageLinks') or {}
        for key in ('extraLarge', 'large', 'medium', 'small', 'thumbnail'):
            image = links.get(key)
            if image:
                return str(image).replace('http://', 'https://').replace('zoom=1', 'zoom=2')
    return ''


def find_cover_url(title: str, author: str) -> str:
    """اولویت: جلد چاپ ایران از دیجی‌کالا؛ بعد Google Books فارسی (در صورت داشتن key)."""
    url = find_digikala_cover_url(title, author)
    if url:
        return url
    return find_google_books_fa_cover_url(title, author)


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
        logger.info('جلد ایرانی برای «%s — %s» پیدا نشد.', book.title, book.author)
        return False
    ok = attach_cover_from_url(book, image_url)
    if ok:
        logger.info('جلد ایرانی کتاب %s ست شد.', book.pk)
    return ok


def enqueue_cover_fetch(book_id: int) -> None:
    from emails.services.queue import enqueue

    from apps.books.tasks import fetch_book_cover_task

    enqueue(fetch_book_cover_task, book_id)
