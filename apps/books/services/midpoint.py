from math import ceil

from django.utils import timezone

from apps.books.models import BookStatus, Entry, EntryKind, EntryMediaType, UserBook


def midpoint_threshold(total_pages: int) -> int:
    """اولین صفحه‌ای که از نیمه عبور کرده حساب می‌شود."""
    if total_pages <= 0:
        return 1
    return ceil(total_pages / 2)


def is_past_midpoint(page: int, total_pages: int) -> bool:
    return total_pages > 0 and page >= midpoint_threshold(total_pages)


def should_ask_midpoint_prediction(user_book: UserBook, *, page: int | None = None) -> bool:
    if user_book.midpoint_prompt_done:
        return False
    if user_book.status == BookStatus.FINISHED:
        return False
    current = user_book.current_page if page is None else page
    return is_past_midpoint(current, user_book.total_pages)


def crossed_midpoint(old_page: int, new_page: int, total_pages: int) -> bool:
    return not is_past_midpoint(old_page, total_pages) and is_past_midpoint(
        new_page, total_pages
    )


def create_ending_prediction(user_book: UserBook, text: str) -> Entry:
    """ثبت پیش‌بینی پایان به‌صورت یادداشت مهروموم‌شده."""
    content = (text or '').strip()
    if not content:
        raise ValueError('متن پیش‌بینی خالی است.')

    page = max(user_book.current_page, midpoint_threshold(user_book.total_pages), 1)
    page = min(page, user_book.total_pages)

    entry = Entry.objects.create(
        user_book=user_book,
        kind=EntryKind.ENDING_PREDICTION,
        media_type=EntryMediaType.TEXT,
        page_number=page,
        text_content=content,
        is_sealed=True,
        is_public=False,
        entry_date=timezone.localdate(),
    )
    if not user_book.midpoint_prompt_done:
        user_book.midpoint_prompt_done = True
        user_book.save(update_fields=['midpoint_prompt_done', 'updated_at'])
    return entry


def dismiss_midpoint_prompt(user_book: UserBook) -> None:
    if user_book.midpoint_prompt_done:
        return
    user_book.midpoint_prompt_done = True
    user_book.save(update_fields=['midpoint_prompt_done', 'updated_at'])
