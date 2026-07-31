from django.db.models import QuerySet

from apps.vocabulary.models import Word


def get_word_queryset(user) -> QuerySet[Word]:
    return Word.objects.filter(owner=user)


def get_user_word(user, word_id: int) -> Word:
    return get_word_queryset(user).get(pk=word_id)


def create_word(
    user,
    *,
    term: str,
    meaning: str,
    usage: str = '',
    audio=None,
) -> Word:
    return Word.objects.create(
        owner=user,
        term=term,
        meaning=meaning,
        usage=usage or '',
        audio=audio,
    )


def update_word(
    word: Word,
    *,
    term: str,
    meaning: str,
    usage: str = '',
    audio=None,
    clear_audio: bool = False,
) -> Word:
    word.term = term
    word.meaning = meaning
    word.usage = usage or ''

    if clear_audio:
        if word.audio:
            word.audio.delete(save=False)
        word.audio = None
    elif audio:
        word.audio = audio

    word.save()
    return word
