"""آماده‌سازی پس از افزودن کتاب: جلد → وایب، بدون بلاک کردن پاسخ HTTP."""

from __future__ import annotations

import logging
import threading

from django.db import close_old_connections, transaction

from apps.books.models import SetupStepStatus, UserBook

logger = logging.getLogger(__name__)

_ACTIVE = {SetupStepStatus.PENDING, SetupStepStatus.RUNNING}


def mark_setup_queued(user_book: UserBook) -> UserBook:
    """قبل از شروع پس‌زمینه، مراحل را در صف بگذار (بدون trigger شدن signal)."""
    from apps.books.models import Book

    has_cover = False
    if user_book.book_id:
        book = Book.objects.filter(pk=user_book.book_id).only('cover').first()
        has_cover = bool(book and book.cover)

    cover_status = SetupStepStatus.DONE if has_cover else SetupStepStatus.PENDING
    UserBook.objects.filter(pk=user_book.pk).update(
        cover_setup_status=cover_status,
        vibe_setup_status=SetupStepStatus.PENDING,
    )
    user_book.cover_setup_status = cover_status
    user_book.vibe_setup_status = SetupStepStatus.PENDING
    return user_book


def _set_status(user_book_id: int, **fields) -> None:
    UserBook.objects.filter(pk=user_book_id).update(**fields)


def serialize_setup_status(user_book: UserBook, request=None) -> dict:
    cover_url = None
    if user_book.book.cover:
        url = user_book.book.cover.url
        cover_url = request.build_absolute_uri(url) if request else url

    cover = user_book.cover_setup_status
    vibe = user_book.vibe_setup_status
    cover_done = cover in {
        SetupStepStatus.DONE,
        SetupStepStatus.SKIPPED,
        SetupStepStatus.FAILED,
    }
    vibe_done = vibe in {
        SetupStepStatus.DONE,
        SetupStepStatus.SKIPPED,
        SetupStepStatus.FAILED,
    }
    ready = cover_done and vibe_done

    # مرحلهٔ فعلی برای UI
    if user_book.cover_setup_status in _ACTIVE:
        current_step = 'cover'
    elif user_book.vibe_setup_status in _ACTIVE:
        current_step = 'vibe'
    elif ready:
        current_step = 'done'
    else:
        current_step = 'shelf'

    return {
        'shelf_id': user_book.pk,
        'title': user_book.title,
        'author': user_book.author,
        'cover_status': cover,
        'vibe_status': vibe,
        'cover_url': cover_url,
        'current_step': current_step,
        'ready': ready,
        'steps': [
            {
                'key': 'shelf',
                'label': 'ثبت در قفسه',
                'status': 'done',
            },
            {
                'key': 'cover',
                'label': 'پیدا کردن جلد',
                'status': cover,
            },
            {
                'key': 'vibe',
                'label': 'به‌روزرسانی گراف شخصیت',
                'status': vibe,
            },
            {
                'key': 'done',
                'label': 'آماده‌سازی تمام',
                'status': 'done' if ready else 'pending',
            },
        ],
    }


def run_shelf_setup(user_book_id: int) -> bool:
    """جلد را (در صورت نیاز) می‌گیرد، بعد وایب را آپدیت می‌کند."""
    close_old_connections()
    try:
        try:
            user_book = UserBook.objects.select_related('book', 'user').get(pk=user_book_id)
        except UserBook.DoesNotExist:
            logger.warning('UserBook %s برای setup پیدا نشد.', user_book_id)
            return False

        # —— جلد ——
        if user_book.book.cover:
            _set_status(user_book_id, cover_setup_status=SetupStepStatus.SKIPPED)
        else:
            _set_status(user_book_id, cover_setup_status=SetupStepStatus.RUNNING)
            try:
                from apps.books.services.covers import fetch_and_set_book_cover

                ok = fetch_and_set_book_cover(user_book.book_id)
                _set_status(
                    user_book_id,
                    cover_setup_status=SetupStepStatus.DONE if ok else SetupStepStatus.FAILED,
                )
            except Exception:
                logger.exception('setup جلد برای UserBook %s شکست خورد.', user_book_id)
                _set_status(user_book_id, cover_setup_status=SetupStepStatus.FAILED)

        # —— وایب ——
        _set_status(user_book_id, vibe_setup_status=SetupStepStatus.RUNNING)
        try:
            from apps.books.services.vibe import update_user_vibe_from_user_book

            user_book = UserBook.objects.select_related('book', 'user').get(pk=user_book_id)
            update_user_vibe_from_user_book(user_book)
            _set_status(user_book_id, vibe_setup_status=SetupStepStatus.DONE)
        except Exception:
            logger.exception('setup وایب برای UserBook %s شکست خورد.', user_book_id)
            _set_status(user_book_id, vibe_setup_status=SetupStepStatus.FAILED)
            return False
        return True
    finally:
        close_old_connections()


def enqueue_shelf_setup(user_book_id: int) -> None:
    """Celery در صورت امکان؛ وگرنه thread تا درخواست HTTP بلاک نشود."""
    from django.conf import settings

    from apps.books.tasks import setup_new_shelf_book_task

    def _spawn_thread() -> None:
        thread = threading.Thread(
            target=run_shelf_setup,
            args=(user_book_id,),
            daemon=True,
            name=f'shelf-setup-{user_book_id}',
        )
        thread.start()

    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        _spawn_thread()
        return

    try:
        setup_new_shelf_book_task.delay(user_book_id)
    except Exception as exc:
        logger.warning(
            'Celery برای setup در دسترس نبود (%s)؛ thread جایگزین.',
            exc.__class__.__name__,
        )
        _spawn_thread()


def schedule_shelf_setup(user_book: UserBook) -> None:
    mark_setup_queued(user_book)
    shelf_id = user_book.pk

    def _enqueue() -> None:
        enqueue_shelf_setup(shelf_id)

    transaction.on_commit(_enqueue)
