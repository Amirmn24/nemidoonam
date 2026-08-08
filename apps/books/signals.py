from __future__ import annotations

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.books.models import UserBook, UserBookDocument


@receiver(post_save, sender=UserBook)
def user_book_created_schedule_setup(sender, instance: UserBook, created: bool, **kwargs) -> None:
    """بعد از افزودن به قفسه: جلد سپس وایب در پس‌زمینه (بدون بلاک پاسخ)."""
    if not created:
        return

    from apps.books.services.setup import schedule_shelf_setup

    schedule_shelf_setup(instance)


@receiver(pre_delete, sender=UserBookDocument)
def delete_document_storage_file(sender, instance: UserBookDocument, **kwargs) -> None:
    """فایل را از استوریج پاک کن؛ محتوا هرگز در DB نبوده."""
    if instance.pdf:
        instance.pdf.delete(save=False)
