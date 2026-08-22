from django.db import models


class SquadResourceKind(models.TextChoices):
    DOCUMENT = 'document', 'فایل سند'
    NOTE = 'note', 'یادداشت'
    LINK = 'link', 'لینک'
    BOOK_REF = 'book_ref', 'منبع از کاتالوگ'
