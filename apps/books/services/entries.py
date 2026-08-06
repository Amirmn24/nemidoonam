from apps.books.models import BookStatus, Entry, UserBook


def is_entry_content_locked(entry: Entry, user_book: UserBook | None = None) -> bool:
    """محتوای مهروموم‌شده تا پایان کتاب قفل است."""
    shelf = user_book or entry.user_book
    return bool(entry.is_sealed and shelf.status != BookStatus.FINISHED)


def redact_entry_for_response(entry: Entry, *, locked: bool) -> Entry:
    """روی نمونهٔ در حافظه محتوا را خالی می‌کند تا در سریالایزر لو نرود."""
    if not locked:
        return entry
    entry.text_content = ''
    entry.image = None
    entry.audio = None
    return entry
