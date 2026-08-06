from django.db import models


class BookStatus(models.TextChoices):
    WANT_TO_READ = 'want_to_read', 'می‌خواهم بخوانم'
    READING = 'reading', 'در حال خواندن'
    PAUSED = 'paused', 'متوقف شده'
    FINISHED = 'finished', 'تمام شده'
    ABANDONED = 'abandoned', 'رها شده'


class EntryMediaType(models.TextChoices):
    TEXT = 'text', 'متن'
    VOICE = 'voice', 'ویس'
    IMAGE = 'image', 'تصویر'


class EntryKind(models.TextChoices):
    VIEWPOINT = 'viewpoint', 'دیدگاه'
    FEELING = 'feeling', 'حس'
    BOOK_TEXT = 'book_text', 'متن کتاب'
    ENDING_PREDICTION = 'ending_prediction', 'پیش‌بینی پایان'


# فاکتورهای امتیازدهی چندبُعدی (۱ تا ۵) — میانگین‌شان نمره کلی می‌شود
RATING_FACTORS = (
    ('writing', 'نثر و زبان'),
    ('content', 'محتوا و ایده'),
    ('characters', 'شخصیت‌پردازی'),
    ('pacing', 'ریتم روایت'),
    ('impact', 'تأثیر عاطفی'),
)
