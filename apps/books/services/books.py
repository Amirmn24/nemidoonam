from django.db.models import Count, Prefetch, QuerySet

from apps.books.models import Book, BookStatus, Entry


def get_book_queryset() -> QuerySet[Book]:
    return Book.objects.annotate(entry_count=Count('entries'))


def get_books_by_status(status: str | None = None) -> QuerySet[Book]:
    qs = get_book_queryset()
    if status and status in BookStatus.values:
        qs = qs.filter(status=status)
    return qs


def get_book_with_entries(book_id: int) -> Book:
    return (
        get_book_queryset()
        .prefetch_related(
            Prefetch('entries', queryset=Entry.objects.select_related('book'))
        )
        .get(pk=book_id)
    )


def filter_entries(
    book: Book,
    *,
    kind: str | None = None,
    media_type: str | None = None,
    page: int | None = None,
) -> QuerySet[Entry]:
    qs = book.entries.all()
    if kind:
        qs = qs.filter(kind=kind)
    if media_type:
        qs = qs.filter(media_type=media_type)
    if page:
        qs = qs.filter(page_number=page)
    return qs
