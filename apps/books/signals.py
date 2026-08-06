from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.books.models import UserBook


@receiver(post_save, sender=UserBook)
def user_book_created_schedule_setup(sender, instance: UserBook, created: bool, **kwargs) -> None:
    """بعد از افزودن به قفسه: جلد سپس وایب در پس‌زمینه (بدون بلاک پاسخ)."""
    if not created:
        return

    from apps.books.services.setup import schedule_shelf_setup

    # schedule_shelf_setup خودش mark + on_commit می‌کند
    # از refresh جلوگیری کن تا در همان تراکنش بماند
    schedule_shelf_setup(instance)
