"""Persian-aware text normalization and book duplicate matching (global catalog)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

from apps.books.models import Book, UserBook


def _shelf_detail_path(shelf_id: int | None) -> str:
    return f'/books/{shelf_id}' if shelf_id else ''

_CHAR_MAP = str.maketrans({
    'ي': 'ی',
    'ى': 'ی',
    'ك': 'ک',
    'ة': 'ه',
    'ۀ': 'ه',
    'ھ': 'ه',
    'ە': 'ه',
    'ؤ': 'و',
    'إ': 'ا',
    'أ': 'ا',
    'ٱ': 'ا',
})

_INVISIBLE = dict.fromkeys(map(ord, '\u200c\u200d\u200e\u200f\ufeff\u00a0'), None)
_TATWEEL = '\u0640'

SIMILAR_COMBINED = 0.84
SIMILAR_TITLE_MIN = 0.78
SIMILAR_AUTHOR_MIN = 0.72


def normalize_text(value: str | None) -> str:
    if not value:
        return ''
    text = unicodedata.normalize('NFKC', str(value)).strip()
    text = text.translate(_CHAR_MAP)
    text = text.translate(_INVISIBLE)
    text = text.replace(_TATWEEL, '')
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = text.casefold()
    text = re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def fingerprint(value: str | None) -> str:
    return normalize_text(value).replace(' ', '')


def text_similarity(a: str | None, b: str | None) -> float:
    left = fingerprint(a)
    right = fingerprint(b)
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def book_match_score(
    title: str,
    author: str,
    other_title: str,
    other_author: str,
) -> tuple[float, float, float]:
    title_score = text_similarity(title, other_title)
    author_score = text_similarity(author, other_author)
    combined = (title_score * 0.58) + (author_score * 0.42)
    return combined, title_score, author_score


def is_exact_duplicate(title: str, author: str, other_title: str, other_author: str) -> bool:
    return (
        fingerprint(title) == fingerprint(other_title)
        and fingerprint(author) == fingerprint(other_author)
    )


def is_similar_duplicate(
    title: str,
    author: str,
    other_title: str,
    other_author: str,
) -> bool:
    if is_exact_duplicate(title, author, other_title, other_author):
        return True
    combined, title_score, author_score = book_match_score(
        title, author, other_title, other_author
    )
    return (
        combined >= SIMILAR_COMBINED
        and title_score >= SIMILAR_TITLE_MIN
        and author_score >= SIMILAR_AUTHOR_MIN
    )


@dataclass(frozen=True)
class BookMatch:
    book: Book
    score: float
    title_score: float
    author_score: float
    is_exact: bool
    on_shelf: bool
    shelf_id: int | None


def _shelf_map(user) -> dict[int, int]:
    return dict(
        UserBook.objects.filter(user=user).values_list('book_id', 'id')
    )


def find_duplicates(
    *,
    title: str,
    author: str,
    owner,
    exclude_book_pk: int | None = None,
    limit: int = 8,
) -> list[BookMatch]:
    """Find exact/similar catalog books (global)."""
    title = (title or '').strip()
    author = (author or '').strip()
    if not title and not author:
        return []

    shelves = _shelf_map(owner)
    qs = Book.objects.all().order_by('-updated_at')
    if exclude_book_pk:
        qs = qs.exclude(pk=exclude_book_pk)
    candidates = list(qs[:700])

    matches: list[BookMatch] = []
    seen_keys: set[tuple[str, str]] = set()

    for book in candidates:
        key = (fingerprint(book.title), fingerprint(book.author))
        if key in seen_keys:
            continue
        exact = is_exact_duplicate(title, author, book.title, book.author)
        combined, t_score, a_score = book_match_score(
            title, author, book.title, book.author
        )
        if not exact and not (
            combined >= SIMILAR_COMBINED
            and t_score >= SIMILAR_TITLE_MIN
            and a_score >= SIMILAR_AUTHOR_MIN
        ):
            if not (t_score >= 0.9 and (not author or a_score >= 0.55)):
                continue

        seen_keys.add(key)
        shelf_id = shelves.get(book.pk)
        matches.append(
            BookMatch(
                book=book,
                score=1.0 if exact else combined,
                title_score=t_score,
                author_score=a_score,
                is_exact=exact,
                on_shelf=shelf_id is not None,
                shelf_id=shelf_id,
            )
        )

    matches.sort(key=lambda m: (m.is_exact, m.on_shelf, m.score), reverse=True)
    return matches[:limit]


def find_exact_on_shelf(
    *,
    title: str,
    author: str,
    owner,
    exclude_shelf_pk: int | None = None,
) -> UserBook | None:
    book = Book.objects.filter(
        title_normalized=fingerprint(title),
        author_normalized=fingerprint(author),
    ).first()
    if not book:
        return None
    qs = UserBook.objects.filter(user=owner, book=book).select_related('book')
    if exclude_shelf_pk:
        qs = qs.exclude(pk=exclude_shelf_pk)
    return qs.first()


def find_exact_catalog(title: str, author: str) -> Book | None:
    title_fp = fingerprint(title)
    author_fp = fingerprint(author)
    if not title_fp or not author_fp:
        return None
    return Book.objects.filter(
        title_normalized=title_fp,
        author_normalized=author_fp,
    ).first()


def _score_query_against(text: str, query: str, q_norm: str, q_fp: str) -> float:
    score = text_similarity(query, text)
    text_n = normalize_text(text)
    text_fp = fingerprint(text)
    if q_norm and q_norm in text_n:
        score = max(score, 0.88)
        if text_n.startswith(q_norm):
            score = max(score, 0.93)
    if q_fp and q_fp in text_fp:
        score = max(score, 0.92)
        if text_fp.startswith(q_fp):
            score = max(score, 0.96)
    return score


def search_title_suggestions(*, owner, query: str, limit: int = 10) -> list[dict]:
    q = (query or '').strip()
    if len(q) < 2:
        return []

    q_norm = normalize_text(q)
    q_fp = fingerprint(q)
    shelves = _shelf_map(owner)
    results: list[dict] = []
    seen: set[tuple[str, str]] = set()

    books = Book.objects.all().order_by('-updated_at')[:800]
    for book in books:
        key = (fingerprint(book.title), fingerprint(book.author))
        if key in seen:
            continue
        score = _score_query_against(book.title, q, q_norm, q_fp)
        if score < 0.45:
            continue
        seen.add(key)
        shelf_id = shelves.get(book.pk)
        on_shelf = shelf_id is not None
        results.append(
            {
                'kind': 'book',
                'id': book.pk,
                'title': book.title,
                'author': book.author,
                'total_pages': book.total_pages,
                'cover_url': book.cover.url if book.cover else '',
                'on_shelf': on_shelf,
                'shelf_id': shelf_id,
                'detail_url': _shelf_detail_path(shelf_id) if on_shelf else '',
                'score': round(score, 3),
                'source_label': 'در قفسه تو' if on_shelf else 'در کتابخانه',
            }
        )

    results.sort(key=lambda row: (row['score'], row['on_shelf']), reverse=True)
    return results[:limit]


def search_author_suggestions(*, owner, query: str, limit: int = 10) -> list[dict]:
    q = (query or '').strip()
    if len(q) < 2:
        return []

    q_norm = normalize_text(q)
    q_fp = fingerprint(q)
    best_by_fp: dict[str, dict] = {}

    for book in Book.objects.all().order_by('-updated_at').only('author')[:1000]:
        author = (book.author or '').strip()
        if not author:
            continue
        fp = fingerprint(author)
        if not fp:
            continue
        score = _score_query_against(author, q, q_norm, q_fp)
        if score < 0.45:
            continue
        prev = best_by_fp.get(fp)
        if prev is None or score > prev['score']:
            best_by_fp[fp] = {
                'kind': 'author',
                'author': author,
                'score': round(score, 3),
                'source_label': 'نویسنده ثبت‌شده در کتابخانه',
            }

    results = list(best_by_fp.values())
    results.sort(key=lambda row: row['score'], reverse=True)
    return results[:limit]


def search_book_suggestions(
    *,
    owner,
    query: str,
    limit: int = 10,
    scope: str = 'books',
) -> list[dict]:
    if scope == 'authors':
        return search_author_suggestions(owner=owner, query=query, limit=limit)
    return search_title_suggestions(owner=owner, query=query, limit=limit)


def serialize_match(match: BookMatch) -> dict:
    book = match.book
    return {
        'kind': 'book',
        'id': book.pk,
        'title': book.title,
        'author': book.author,
        'total_pages': book.total_pages,
        'cover_url': book.cover.url if book.cover else '',
        'on_shelf': match.on_shelf,
        'shelf_id': match.shelf_id,
        'is_exact': match.is_exact,
        'score': round(match.score, 3),
        'detail_url': (
            _shelf_detail_path(match.shelf_id)
            if match.on_shelf and match.shelf_id
            else ''
        ),
        'source_label': 'در قفسه تو' if match.on_shelf else 'در کتابخانه',
    }
