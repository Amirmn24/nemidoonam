from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.books.models import Book, BookStatus, Entry, EntryKind, EntryMediaType, UserBook
from apps.books.models.choices import RATING_FACTORS
from apps.books.services.books import (
    filter_entries,
    get_books_by_status,
    get_shelf_queryset,
)
from apps.books.services.catalog import add_book_to_shelf, create_shelf_book, update_shelf_book
from apps.books.services.entries import (
    is_entry_content_locked,
    playlist_entries,
    redact_entry_for_response,
)
from apps.books.services.matching import (
    find_duplicates,
    find_exact_catalog,
    find_exact_on_shelf,
    is_similar_duplicate,
    search_book_suggestions,
    serialize_match,
)
from apps.books.services.midpoint import (
    create_ending_prediction,
    crossed_midpoint,
    dismiss_midpoint_prompt,
    should_ask_midpoint_prediction,
)
from apps.books.services.ratings import get_rating_for_shelf, serialize_rating, upsert_book_rating


def _media_url(request, field):
    if not field:
        return None
    url = field.url
    return request.build_absolute_uri(url) if request else url


class ShelfBookSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    book_id = serializers.IntegerField()
    title = serializers.CharField()
    author = serializers.CharField()
    total_pages = serializers.IntegerField()
    cover_url = serializers.SerializerMethodField()
    current_page = serializers.IntegerField()
    progress_percent = serializers.IntegerField()
    status = serializers.CharField()
    status_display = serializers.CharField(source='get_status_display')
    notes = serializers.CharField()
    entry_count = serializers.SerializerMethodField()
    overall_score = serializers.SerializerMethodField()
    has_rating = serializers.SerializerMethodField()
    midpoint_prompt_done = serializers.BooleanField()
    ask_midpoint_prediction = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()

    def get_cover_url(self, obj):
        return _media_url(self.context.get('request'), obj.cover)

    def get_entry_count(self, obj):
        if hasattr(obj, 'entry_count'):
            return obj.entry_count
        return obj.entries.count()

    def get_overall_score(self, obj):
        rating = get_rating_for_shelf(obj)
        return rating.overall_score if rating else None

    def get_has_rating(self, obj):
        return get_rating_for_shelf(obj) is not None

    def get_ask_midpoint_prediction(self, obj):
        return should_ask_midpoint_prediction(obj)


class EntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user_book_id = serializers.IntegerField()
    kind = serializers.CharField()
    kind_display = serializers.CharField(source='get_kind_display')
    media_type = serializers.CharField()
    media_type_display = serializers.CharField(source='get_media_type_display')
    page_number = serializers.IntegerField()
    text_content = serializers.CharField()
    image_url = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()
    is_public = serializers.BooleanField()
    is_sealed = serializers.BooleanField()
    is_content_locked = serializers.SerializerMethodField()
    entry_date = serializers.DateField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    def get_is_content_locked(self, obj):
        return bool(getattr(obj, '_content_locked', False))

    def get_image_url(self, obj):
        if getattr(obj, '_content_locked', False):
            return None
        return _media_url(self.context.get('request'), obj.image)

    def get_audio_url(self, obj):
        if getattr(obj, '_content_locked', False):
            return None
        return _media_url(self.context.get('request'), obj.audio)


def _serialize_entries(entries, user_book, request, *, redact_locked=True):
    payload = []
    for entry in entries:
        locked = is_entry_content_locked(entry, user_book)
        entry._content_locked = locked
        if redact_locked and locked:
            redact_entry_for_response(entry, locked=True)
        payload.append(entry)
    return EntrySerializer(payload, many=True, context={'request': request}).data


class EmptyIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if data in ('', None):
            return None
        return super().to_internal_value(data)


class ShelfWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    author = serializers.CharField(max_length=255)
    total_pages = serializers.IntegerField(min_value=1)
    current_page = EmptyIntegerField(min_value=0, required=False, default=0)
    status = serializers.ChoiceField(choices=BookStatus.choices, default=BookStatus.WANT_TO_READ)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    cover = serializers.ImageField(required=False, allow_null=True)
    catalog_book_id = EmptyIntegerField(required=False, allow_null=True)
    confirm_similar = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        user = self.context['request'].user
        user_book = self.context.get('user_book')
        catalog_id = attrs.get('catalog_book_id')
        current_page = attrs.get('current_page') or 0
        total_pages = attrs.get('total_pages')
        if total_pages is not None and current_page > total_pages:
            raise serializers.ValidationError(
                {'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'}
            )

        if catalog_id:
            book = Book.objects.filter(pk=catalog_id).first()
            if not book:
                raise serializers.ValidationError('کتاب انتخاب‌شده پیدا نشد.')
            shelf = UserBook.objects.filter(user=user, book=book).first()
            if shelf and (not user_book or shelf.pk != user_book.pk):
                raise serializers.ValidationError(
                    f'کتاب «{book.title}» از قبل در قفسه‌ات هست.'
                )
            attrs['_catalog_book'] = book
            return attrs

        title = attrs['title'].strip()
        author = attrs['author'].strip()
        attrs['title'] = title
        attrs['author'] = author

        exclude_shelf = user_book.pk if user_book else None
        exclude_book = user_book.book_id if user_book else None

        on_shelf = find_exact_on_shelf(
            title=title,
            author=author,
            owner=user,
            exclude_shelf_pk=exclude_shelf,
        )
        if on_shelf:
            raise serializers.ValidationError(
                f'کتاب «{on_shelf.title}» از «{on_shelf.author}» از قبل در قفسه‌ات هست.'
            )

        catalog = find_exact_catalog(title, author)
        if catalog and (not exclude_book or catalog.pk != exclude_book):
            attrs['catalog_book_id'] = catalog.pk
            attrs['_catalog_book'] = catalog

        matches = find_duplicates(
            title=title,
            author=author,
            owner=user,
            exclude_book_pk=exclude_book,
        )
        strong = [
            m
            for m in matches
            if is_similar_duplicate(title, author, m.book.title, m.book.author)
            and not m.is_exact
        ]
        similar = strong or [m for m in matches if not m.is_exact][:5]
        attrs['_similar_matches'] = similar
        if strong and not attrs.get('confirm_similar'):
            sample = strong[0].book
            raise serializers.ValidationError(
                f'کتابی شبیه «{sample.title}» — {sample.author} در کتابخانه هست. '
                'اگر همان است از پیشنهادها انتخاب/اضافه کن؛ '
                'اگر کتاب دیگری است گزینه تأیید را بزن.'
            )
        return attrs


class ProgressSerializer(serializers.Serializer):
    current_page = serializers.IntegerField(min_value=0)
    status = serializers.ChoiceField(choices=BookStatus.choices)

    def validate(self, attrs):
        user_book = self.context['user_book']
        current_page = attrs['current_page']
        if current_page > user_book.total_pages:
            raise serializers.ValidationError(
                {'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'}
            )
        if attrs['status'] == BookStatus.FINISHED:
            attrs['current_page'] = user_book.total_pages
        return attrs


class EntryWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=EntryKind.choices, default=EntryKind.VIEWPOINT)
    media_type = serializers.ChoiceField(choices=EntryMediaType.choices, default=EntryMediaType.TEXT)
    page_number = serializers.IntegerField(min_value=1)
    entry_date = serializers.DateField(required=False)
    text_content = serializers.CharField(required=False, allow_blank=True, default='')
    image = serializers.ImageField(required=False, allow_null=True)
    audio = serializers.FileField(required=False, allow_null=True)
    is_public = serializers.BooleanField(required=False, default=False)
    is_sealed = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        user_book = self.context['user_book']
        instance = self.context.get('instance')
        page_number = attrs.get('page_number')
        if page_number and page_number > user_book.total_pages:
            raise serializers.ValidationError(
                {'page_number': 'شماره صفحه نمی‌تواند بیشتر از تعداد صفحات کتاب باشد.'}
            )

        media_type = attrs.get('media_type') or (instance.media_type if instance else EntryMediaType.TEXT)
        text_content = (attrs.get('text_content') or '').strip()
        image = attrs.get('image')
        audio = attrs.get('audio')
        content_locked = bool(
            instance
            and is_entry_content_locked(instance, user_book)
            and attrs.get('is_sealed', instance.is_sealed)
        )

        if not content_locked:
            if media_type == EntryMediaType.TEXT and not text_content:
                raise serializers.ValidationError({'text_content': 'برای محتوای متنی، نوشتن متن الزامی است.'})
            if media_type == EntryMediaType.IMAGE and not image and not (instance and instance.image):
                raise serializers.ValidationError({'image': 'برای محتوای تصویری، آپلود تصویر الزامی است.'})
            if media_type == EntryMediaType.VOICE and not audio and not (instance and instance.audio):
                raise serializers.ValidationError({'audio': 'برای محتوای صوتی، ضبط ویس الزامی است.'})

        attrs['text_content'] = text_content
        attrs['_content_locked'] = content_locked
        return attrs


class MidpointPredictionSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, default='')
    dismiss = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if attrs.get('dismiss'):
            return attrs
        text = (attrs.get('text') or '').strip()
        if not text:
            raise serializers.ValidationError({'text': 'پیش‌بینی‌ات را بنویس.'})
        attrs['text'] = text
        return attrs


class RatingWriteSerializer(serializers.Serializer):
    writing = serializers.IntegerField(min_value=1, max_value=5)
    content = serializers.IntegerField(min_value=1, max_value=5)
    characters = serializers.IntegerField(min_value=1, max_value=5)
    pacing = serializers.IntegerField(min_value=1, max_value=5)
    impact = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True, default='')


class MetaChoicesView(APIView):
    def get(self, request):
        return Response(
            {
                'book_statuses': [
                    {'value': value, 'label': label} for value, label in BookStatus.choices
                ],
                'entry_kinds': [
                    {'value': value, 'label': label} for value, label in EntryKind.choices
                ],
                'entry_media_types': [
                    {'value': value, 'label': label} for value, label in EntryMediaType.choices
                ],
                'rating_factors': [
                    {'key': key, 'label': label} for key, label in RATING_FACTORS
                ],
            }
        )


class SuggestView(APIView):
    def get(self, request):
        mode = request.query_params.get('mode', '').strip()
        if mode == 'match':
            title = request.query_params.get('title', '')
            author = request.query_params.get('author', '')
            exclude = request.query_params.get('exclude')
            exclude_pk = int(exclude) if exclude and str(exclude).isdigit() else None
            matches = find_duplicates(
                title=title,
                author=author,
                owner=request.user,
                exclude_book_pk=exclude_pk,
            )
            return Response({'results': [serialize_match(m) for m in matches]})

        q = request.query_params.get('q', '')
        scope = request.query_params.get('scope', 'books')
        results = search_book_suggestions(
            owner=request.user,
            query=q,
            scope=scope,
        )
        return Response({'results': results, 'scope': scope})


class ShelfViewSet(ViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_shelf(self, request, pk):
        return get_object_or_404(get_shelf_queryset(request.user), pk=pk)

    def list(self, request):
        status_filter = request.query_params.get('status') or None
        books = get_books_by_status(request.user, status_filter)
        all_books = get_shelf_queryset(request.user)
        serializer = ShelfBookSerializer(books, many=True, context={'request': request})
        return Response(
            {
                'results': serializer.data,
                'statuses': [
                    {'value': value, 'label': label} for value, label in BookStatus.choices
                ],
                'active_status': status_filter if status_filter in BookStatus.values else '',
                'total_count': all_books.count(),
                'reading_count': all_books.filter(status=BookStatus.READING).count(),
                'finished_count': all_books.filter(status=BookStatus.FINISHED).count(),
            }
        )

    def retrieve(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        kind = request.query_params.get('kind') or None
        media = request.query_params.get('media') or None
        is_finished = user_book.status == BookStatus.FINISHED
        if is_finished:
            entries = playlist_entries(user_book)
        else:
            entries = filter_entries(user_book, kind=kind, media_type=media)
        rating = get_rating_for_shelf(user_book)
        return Response(
            {
                'book': ShelfBookSerializer(user_book, context={'request': request}).data,
                'entries': _serialize_entries(entries, user_book, request),
                'rating': serialize_rating(rating),
                'rating_factors': [
                    {'key': key, 'label': label} for key, label in RATING_FACTORS
                ],
                'active_kind': kind or '',
                'active_media': media or '',
                'ask_midpoint_prediction': should_ask_midpoint_prediction(user_book),
                'view_mode': 'playlist' if is_finished else 'reading',
            }
        )

    def create(self, request):
        serializer = ShelfWriteSerializer(data=request.data, context={'request': request})
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as exc:
            similar = []
            # Re-run matching for response payload when similar confirmation needed
            raw = request.data
            title = (raw.get('title') or '').strip()
            author = (raw.get('author') or '').strip()
            if title and author and not raw.get('catalog_book_id'):
                matches = find_duplicates(title=title, author=author, owner=request.user)
                strong = [
                    m
                    for m in matches
                    if is_similar_duplicate(title, author, m.book.title, m.book.author)
                    and not m.is_exact
                ]
                similar = [serialize_match(m) for m in (strong or [m for m in matches if not m.is_exact][:5])]
            detail = exc.detail
            if isinstance(detail, dict) and 'non_field_errors' in detail:
                message = detail['non_field_errors'][0]
            elif isinstance(detail, list):
                message = detail[0]
            elif isinstance(detail, dict):
                first = next(iter(detail.values()))
                message = first[0] if isinstance(first, list) else first
            else:
                message = str(detail)
            return Response(
                {
                    'detail': message,
                    'errors': detail if isinstance(detail, dict) else {},
                    'similar_matches': similar,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        catalog_book = data.get('_catalog_book')
        if catalog_book:
            user_book, created = add_book_to_shelf(
                request.user,
                catalog_book,
                current_page=min(data.get('current_page') or 0, catalog_book.total_pages),
                status=data.get('status', BookStatus.WANT_TO_READ),
                notes=data.get('notes') or '',
            )
        else:
            user_book, created, _ = create_shelf_book(
                request.user,
                title=data['title'],
                author=data['author'],
                total_pages=data['total_pages'],
                current_page=data.get('current_page') or 0,
                status=data.get('status', BookStatus.WANT_TO_READ),
                notes=data.get('notes') or '',
                cover=data.get('cover'),
            )
        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        return Response(
            ShelfBookSerializer(user_book, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def partial_update(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        serializer = ShelfWriteSerializer(
            data=request.data,
            context={'request': request, 'user_book': user_book},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if data.get('_catalog_book'):
                book = data['_catalog_book']
                if book.pk != user_book.book_id:
                    clash = UserBook.objects.filter(user=request.user, book=book).exclude(
                        pk=user_book.pk
                    )
                    if clash.exists():
                        raise DjangoValidationError('این کتاب از قبل در قفسه‌ات هست.')
                    user_book.book = book
                    user_book.save(update_fields=['book', 'updated_at'])
                user_book.current_page = min(
                    data.get('current_page') or 0, user_book.book.total_pages
                )
                user_book.status = data.get('status', user_book.status)
                user_book.notes = data.get('notes') or ''
                user_book.save()
            else:
                user_book = update_shelf_book(
                    user_book,
                    title=data['title'],
                    author=data['author'],
                    total_pages=data['total_pages'],
                    current_page=data.get('current_page') or 0,
                    status=data.get('status', BookStatus.WANT_TO_READ),
                    notes=data.get('notes') or '',
                    cover=data.get('cover'),
                )
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, 'messages') else str(exc)
            return Response(
                {'detail': message, 'errors': {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        return Response(ShelfBookSerializer(user_book, context={'request': request}).data)

    def destroy(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        user_book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def progress(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        serializer = ProgressSerializer(
            data=request.data,
            context={'user_book': user_book},
        )
        serializer.is_valid(raise_exception=True)
        old_page = user_book.current_page
        new_page = serializer.validated_data['current_page']
        user_book.current_page = new_page
        user_book.status = serializer.validated_data['status']
        user_book.save()
        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        ask = (
            not user_book.midpoint_prompt_done
            and user_book.status != BookStatus.FINISHED
            and (
                crossed_midpoint(old_page, new_page, user_book.total_pages)
                or should_ask_midpoint_prediction(user_book)
            )
        )
        payload = ShelfBookSerializer(user_book, context={'request': request}).data
        return Response({**payload, 'ask_midpoint_prediction': ask})

    @action(detail=True, methods=['post'], url_path='midpoint-prediction')
    def midpoint_prediction(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        serializer = MidpointPredictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get('dismiss'):
            dismiss_midpoint_prompt(user_book)
            user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
            return Response(
                {
                    'book': ShelfBookSerializer(user_book, context={'request': request}).data,
                    'entry': None,
                    'ask_midpoint_prediction': False,
                }
            )

        if user_book.status == BookStatus.FINISHED:
            return Response(
                {'detail': 'کتاب تمام شده؛ پیش‌بینی نیمه‌راه دیگر لازم نیست.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            entry = create_ending_prediction(user_book, data['text'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        entry._content_locked = is_entry_content_locked(entry, user_book)
        return Response(
            {
                'book': ShelfBookSerializer(user_book, context={'request': request}).data,
                'entry': EntrySerializer(entry, context={'request': request}).data,
                'ask_midpoint_prediction': False,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        """تیک پایان کتاب — صفحه را کامل و وضعیت را finished می‌کند."""
        user_book = self._get_shelf(request, pk)
        user_book.current_page = user_book.total_pages
        user_book.status = BookStatus.FINISHED
        user_book.save(update_fields=['current_page', 'status', 'updated_at'])
        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        return Response(
            {
                'book': ShelfBookSerializer(user_book, context={'request': request}).data,
                'rating': serialize_rating(get_rating_for_shelf(user_book)),
                'rating_factors': [
                    {'key': key, 'label': label} for key, label in RATING_FACTORS
                ],
                'view_mode': 'playlist',
            }
        )

    @action(detail=True, methods=['get', 'put', 'patch'])
    def rating(self, request, pk=None):
        user_book = self._get_shelf(request, pk)
        if request.method == 'GET':
            return Response(
                {
                    'rating': serialize_rating(get_rating_for_shelf(user_book)),
                    'rating_factors': [
                        {'key': key, 'label': label} for key, label in RATING_FACTORS
                    ],
                    'can_rate': user_book.status == BookStatus.FINISHED,
                }
            )

        serializer = RatingWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            rating = upsert_book_rating(
                user_book,
                scores={key: data[key] for key, _ in RATING_FACTORS},
                review=data.get('review') or '',
            )
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, 'messages') else str(exc)
            detail = exc.message_dict if hasattr(exc, 'message_dict') else {'detail': message}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)

        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        return Response(
            {
                'book': ShelfBookSerializer(user_book, context={'request': request}).data,
                'rating': serialize_rating(rating),
            }
        )


class CatalogAddView(APIView):
    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        user_book, created = add_book_to_shelf(request.user, book)
        user_book = get_shelf_queryset(request.user).get(pk=user_book.pk)
        return Response(
            ShelfBookSerializer(user_book, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EntryViewSet(ViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_shelf(self, request, book_pk):
        return get_object_or_404(get_shelf_queryset(request.user), pk=book_pk)

    def _entry_response(self, entry, user_book, request, *, redact_locked=True):
        locked = is_entry_content_locked(entry, user_book)
        entry._content_locked = locked
        if redact_locked and locked:
            redact_entry_for_response(entry, locked=True)
        return EntrySerializer(entry, context={'request': request}).data

    def list(self, request, book_pk=None):
        user_book = self._get_shelf(request, book_pk)
        kind = request.query_params.get('kind') or None
        media = request.query_params.get('media') or None
        entries = filter_entries(user_book, kind=kind, media_type=media)
        return Response(_serialize_entries(entries, user_book, request))

    def create(self, request, book_pk=None):
        user_book = self._get_shelf(request, book_pk)
        serializer = EntryWriteSerializer(
            data=request.data,
            context={'user_book': user_book},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        from django.utils import timezone

        old_page = user_book.current_page
        entry = Entry(
            user_book=user_book,
            kind=data['kind'],
            media_type=data['media_type'],
            page_number=data['page_number'],
            entry_date=data.get('entry_date') or timezone.localdate(),
            text_content=data.get('text_content') or '',
            is_public=bool(data.get('is_public', False)),
            is_sealed=bool(data.get('is_sealed', False)),
        )
        if data.get('image'):
            entry.image = data['image']
        if data.get('audio'):
            entry.audio = data['audio']
        entry.save()

        if entry.page_number > user_book.current_page:
            user_book.current_page = entry.page_number
            user_book.save(update_fields=['current_page', 'updated_at'])

        ask = (
            not user_book.midpoint_prompt_done
            and user_book.status != BookStatus.FINISHED
            and (
                crossed_midpoint(old_page, user_book.current_page, user_book.total_pages)
                or should_ask_midpoint_prediction(user_book)
            )
        )
        payload = self._entry_response(entry, user_book, request)
        payload['ask_midpoint_prediction'] = ask
        return Response(payload, status=status.HTTP_201_CREATED)

    def partial_update(self, request, book_pk=None, pk=None):
        user_book = self._get_shelf(request, book_pk)
        entry = get_object_or_404(Entry, pk=pk, user_book=user_book)
        # Fill defaults from instance for partial
        merged = {
            'kind': request.data.get('kind', entry.kind),
            'media_type': request.data.get('media_type', entry.media_type),
            'page_number': request.data.get('page_number', entry.page_number),
            'entry_date': request.data.get('entry_date', entry.entry_date),
            'text_content': request.data.get('text_content', entry.text_content),
            'is_public': request.data.get('is_public', entry.is_public),
            'is_sealed': request.data.get('is_sealed', entry.is_sealed),
        }
        if 'image' in request.data:
            merged['image'] = request.data.get('image')
        if 'audio' in request.data:
            merged['audio'] = request.data.get('audio')
        serializer = EntryWriteSerializer(
            data=merged,
            context={'user_book': user_book, 'instance': entry},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entry.kind = data['kind']
        entry.media_type = data['media_type']
        entry.page_number = data['page_number']
        if data.get('entry_date'):
            entry.entry_date = data['entry_date']
        entry.is_public = bool(data.get('is_public', False))
        entry.is_sealed = bool(data.get('is_sealed', False))
        if not data.get('_content_locked'):
            entry.text_content = data.get('text_content') or ''
            if data.get('image'):
                entry.image = data['image']
            if data.get('audio'):
                entry.audio = data['audio']
        entry.save()
        # Refresh from DB so redaction doesn't wipe real files in memory for response path
        entry.refresh_from_db()
        return Response(self._entry_response(entry, user_book, request, redact_locked=False))

    def destroy(self, request, book_pk=None, pk=None):
        user_book = self._get_shelf(request, book_pk)
        entry = get_object_or_404(Entry, pk=pk, user_book=user_book)
        if entry.image:
            entry.image.delete(save=False)
        if entry.audio:
            entry.audio.delete(save=False)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, book_pk=None, pk=None):
        user_book = self._get_shelf(request, book_pk)
        entry = get_object_or_404(Entry, pk=pk, user_book=user_book)
        # برای فرم ویرایش محتوا را برمی‌گردانیم؛ قفل فقط در تایم‌لاین اعمال می‌شود.
        locked = is_entry_content_locked(entry, user_book)
        entry._content_locked = locked
        return Response(EntrySerializer(entry, context={'request': request}).data)
