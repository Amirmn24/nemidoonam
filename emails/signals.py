from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.books.models import UserBook
from emails.services.queue import enqueue
from emails.tasks import on_reading_progress_task


@receiver(post_save, sender=UserBook)
def user_book_progress_changed(sender, instance: UserBook, **kwargs) -> None:
    user_id = instance.user_id
    book_id = instance.book_id
    transaction.on_commit(
        lambda: enqueue(on_reading_progress_task, user_id, book_id)
    )
