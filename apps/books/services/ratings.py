from django.core.exceptions import ValidationError

from django.core.exceptions import ObjectDoesNotExist

from apps.books.models import BookRating, BookStatus, UserBook
from apps.books.models.choices import RATING_FACTORS


def get_rating_for_shelf(user_book: UserBook) -> BookRating | None:
    try:
        return user_book.rating
    except ObjectDoesNotExist:
        return None
    except AttributeError:
        return BookRating.objects.filter(user_book=user_book).first()


def upsert_book_rating(
    user_book: UserBook,
    *,
    scores: dict[str, int],
    review: str = '',
) -> BookRating:
    if user_book.status != BookStatus.FINISHED:
        raise ValidationError('فقط بعد از اتمام کتاب می‌توان امتیاز داد.')

    payload = {}
    for key, _label in RATING_FACTORS:
        if key not in scores:
            raise ValidationError({key: 'این فاکتور الزامی است.'})
        value = int(scores[key])
        if value < 1 or value > 5:
            raise ValidationError({key: 'امتیاز باید بین ۱ تا ۵ باشد.'})
        payload[key] = value

    rating, _created = BookRating.objects.update_or_create(
        user_book=user_book,
        defaults={**payload, 'review': (review or '').strip()},
    )
    return rating


def serialize_rating(rating: BookRating | None) -> dict | None:
    if not rating:
        return None
    return {
        'id': rating.pk,
        'factors': [
            {'key': key, 'label': label, 'score': getattr(rating, key)}
            for key, label in RATING_FACTORS
        ],
        'overall_score': rating.overall_score,
        'review': rating.review,
        'updated_at': rating.updated_at,
        'created_at': rating.created_at,
    }
