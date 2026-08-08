from __future__ import annotations

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.books.models import UserBook, UserBookDocument
from apps.books.services import object_storage as storage


@receiver(post_save, sender=UserBook)
def user_book_created_schedule_setup(sender, instance: UserBook, created: bool, **kwargs) -> None:
    if not created:
        return
    from apps.books.services.setup import schedule_shelf_setup

    schedule_shelf_setup(instance)


@receiver(pre_delete, sender=UserBookDocument)
def delete_document_storage_object(sender, instance: UserBookDocument, **kwargs) -> None:
    if instance.storage_key:
        storage.delete_object(instance.storage_key)
