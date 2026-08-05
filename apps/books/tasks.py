from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=45)
def analyze_reading_vibe_task(self, user_book_id: int) -> bool:
    """بعد از افزودن کتاب به قفسه، وایب مطالعاتی را با GPT تازه می‌کند."""
    from apps.books.models import UserBook
    from apps.books.services.vibe import update_user_vibe_from_user_book

    try:
        user_book = UserBook.objects.select_related('book', 'user').get(pk=user_book_id)
    except UserBook.DoesNotExist:
        logger.warning('UserBook %s برای تحلیل وایب پیدا نشد.', user_book_id)
        return False

    try:
        update_user_vibe_from_user_book(user_book)
        return True
    except Exception as exc:
        logger.exception('تحلیل وایب برای UserBook %s شکست خورد.', user_book_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return False
