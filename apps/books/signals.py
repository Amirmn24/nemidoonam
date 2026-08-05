from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.books.models import UserBook


@receiver(post_save, sender=UserBook)
def user_book_created_update_vibe(sender, instance: UserBook, created: bool, **kwargs) -> None:
    """فقط وقتی کتاب تازه به قفسه اضافه شود وایب را به‌روز کن."""
    if not created:
        return
    user_book_id = instance.pk

    def _enqueue() -> None:
        from apps.books.services.vibe import enqueue_vibe_update

        enqueue_vibe_update(user_book_id)

    transaction.on_commit(_enqueue)
