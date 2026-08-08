from django.db.models import Count, Prefetch, QuerySet

from apps.books.models import BookStatus, Entry, UserBook


def get_shelf_queryset(user) -> QuerySet[UserBook]:
    return (
        UserBook.objects.filter(user=user)
        .select_related('book', 'rating', 'document')
        .annotate(entry_count=Count('entries'))
    )


def get_books_by_status(
    user,
    status: str | None = None,
) -> QuerySet[UserBook]:
    qs = get_shelf_queryset(user)
    if status and status in BookStatus.values:
        qs = qs.filter(status=status)
    return qs


def get_user_shelf_book(user, shelf_id: int) -> UserBook:
    return get_shelf_queryset(user).get(pk=shelf_id)


def get_shelf_book_with_entries(user, shelf_id: int) -> UserBook:
    return (
        get_shelf_queryset(user)
        .prefetch_related(
            Prefetch('entries', queryset=Entry.objects.select_related('user_book__book'))
        )
        .get(pk=shelf_id)
    )


def filter_entries(
    user_book: UserBook,
    *,
    kind: str | None = None,
    media_type: str | None = None,
    page: int | None = None,
) -> QuerySet[Entry]:
    qs = user_book.entries.all()
    if kind:
        qs = qs.filter(kind=kind)
    if media_type:
        qs = qs.filter(media_type=media_type)
    if page:
        qs = qs.filter(page_number=page)
    return qs


# Backwards-compatible aliases used by older imports
get_book_queryset = get_shelf_queryset
get_user_book = get_user_shelf_book
get_book_with_entries = get_shelf_book_with_entries
