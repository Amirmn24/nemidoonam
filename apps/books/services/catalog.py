"""Catalog helpers: global Book uniqueness + per-user shelf (UserBook)."""

from __future__ import annotations

from django.db import transaction

from apps.books.models import Book, BookStatus, UserBook
from apps.books.services.matching import fingerprint


def get_catalog_book_by_identity(title: str, author: str) -> Book | None:
    title_fp = fingerprint(title)
    author_fp = fingerprint(author)
    if not title_fp or not author_fp:
        return None
    return Book.objects.filter(
        title_normalized=title_fp,
        author_normalized=author_fp,
    ).first()


@transaction.atomic
def get_or_create_catalog_book(
    *,
    title: str,
    author: str,
    total_pages: int,
    cover=None,
) -> tuple[Book, bool]:
    """Find global book by normalized title+author, or create it."""
    existing = get_catalog_book_by_identity(title, author)
    if existing:
        changed = False
        # Fill missing cover; keep larger page count if more complete
        if cover and not existing.cover:
            existing.cover = cover
            changed = True
        if total_pages and total_pages > existing.total_pages:
            existing.total_pages = total_pages
            changed = True
        if changed:
            existing.save()
        return existing, False

    book = Book(
        title=title.strip(),
        author=author.strip(),
        total_pages=total_pages,
    )
    if cover:
        book.cover = cover
    book.save()
    return book, True


@transaction.atomic
def add_book_to_shelf(
    user,
    book: Book,
    *,
    current_page: int = 0,
    status: str = BookStatus.WANT_TO_READ,
    notes: str = '',
) -> tuple[UserBook, bool]:
    """Attach a catalog book to the user's shelf. Returns (user_book, created)."""
    user_book, created = UserBook.objects.get_or_create(
        user=user,
        book=book,
        defaults={
            'current_page': current_page,
            'status': status,
            'notes': notes or '',
        },
    )
    return user_book, created


@transaction.atomic
def create_shelf_book(
    user,
    *,
    title: str,
    author: str,
    total_pages: int,
    current_page: int = 0,
    status: str = BookStatus.WANT_TO_READ,
    notes: str = '',
    cover=None,
) -> tuple[UserBook, bool, bool]:
    """
    Create/find catalog book and put it on the user's shelf.
    Returns (user_book, shelf_created, catalog_created).
    """
    book, catalog_created = get_or_create_catalog_book(
        title=title,
        author=author,
        total_pages=total_pages,
        cover=cover,
    )
    user_book, shelf_created = add_book_to_shelf(
        user,
        book,
        current_page=min(current_page, book.total_pages),
        status=status,
        notes=notes,
    )
    return user_book, shelf_created, catalog_created


@transaction.atomic
def update_shelf_book(
    user_book: UserBook,
    *,
    title: str,
    author: str,
    total_pages: int,
    current_page: int,
    status: str,
    notes: str = '',
    cover=None,
) -> UserBook:
    """
    Update shelf fields. Title/author may re-link to another catalog book
    (never mutate a shared catalog row's identity in place).
    """
    book, _ = get_or_create_catalog_book(
        title=title,
        author=author,
        total_pages=total_pages,
        cover=cover,
    )
    if book.pk != user_book.book_id:
        clash = UserBook.objects.filter(user=user_book.user, book=book).exclude(
            pk=user_book.pk
        )
        if clash.exists():
            from django.core.exceptions import ValidationError

            raise ValidationError('این کتاب از قبل در قفسه‌ات هست.')
        user_book.book = book
    elif cover and not book.cover:
        book.cover = cover
        book.save(update_fields=['cover', 'updated_at'])
    elif total_pages and total_pages != book.total_pages:
        # Only bump pages if this is the sole shelf copy, else keep catalog stable
        if book.shelves.count() <= 1:
            book.total_pages = total_pages
            book.save(update_fields=['total_pages', 'updated_at'])

    user_book.current_page = min(current_page, user_book.book.total_pages)
    user_book.status = status
    user_book.notes = notes or ''
    user_book.save()
    return user_book
