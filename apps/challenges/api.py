from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.books.models import UserBook
from apps.challenges.models import ChallengePeriodUnit, ChallengeStatus
from apps.challenges.services.challenges import (
    ChallengeProgress,
    compute_progress,
    create_challenge,
    get_challenge_queryset,
    get_challenges_by_status,
    refresh_challenges_for_user,
    refresh_status,
    update_challenge,
)


class ChallengeProgressSerializer(serializers.Serializer):
    time_percent = serializers.IntegerField()
    completion_percent = serializers.IntegerField()
    books_done = serializers.IntegerField()
    books_total = serializers.IntegerField()
    days_elapsed = serializers.IntegerField()
    days_total = serializers.IntegerField()
    days_left = serializers.IntegerField()
    is_started = serializers.BooleanField()
    is_overdue = serializers.BooleanField()


def _shelf_course(user_book: UserBook | None) -> str:
    if user_book is None:
        return ''
    try:
        doc = user_book.document
    except ObjectDoesNotExist:
        return ''
    return doc.course or ''


def serialize_challenge(challenge, request, *, progress: ChallengeProgress | None = None):
    progress = progress or compute_progress(challenge)
    shelf_map = {
        ub.book_id: ub
        for ub in UserBook.objects.filter(
            user=challenge.owner_id,
            book_id__in=list(challenge.books.values_list('id', flat=True)),
        ).select_related('book', 'document')
    }
    books = []
    for cb in challenge.challenge_books.all():
        book = cb.book
        ub = shelf_map.get(book.pk)
        books.append(
            {
                'book_id': book.pk,
                'resource_kind': book.resource_kind,
                'resource_kind_display': book.get_resource_kind_display(),
                'is_digital': book.is_digital,
                'title': book.title,
                'author': book.author,
                'course': _shelf_course(ub),
                'target_pages': cb.target_pages,
                'shelf_id': ub.pk if ub else None,
                'progress_percent': ub.progress_percent if ub else 0,
                'shelf_status': ub.status if ub else None,
                'shelf_status_display': ub.get_status_display() if ub else 'خارج از قفسه',
                'cover_url': (
                    request.build_absolute_uri(book.cover.url)
                    if book.cover and request
                    else (book.cover.url if book.cover else None)
                ),
                'total_pages': book.total_pages,
            }
        )
    return {
        'id': challenge.pk,
        'title': challenge.title,
        'description': challenge.description,
        'period_unit': challenge.period_unit,
        'period_unit_display': challenge.get_period_unit_display(),
        'duration': challenge.duration,
        'period_label': challenge.period_label,
        'starts_on': challenge.starts_on,
        'ends_on': challenge.ends_on,
        'status': challenge.status,
        'status_display': challenge.get_status_display(),
        'books': books,
        'progress': ChallengeProgressSerializer(progress).data,
        'created_at': challenge.created_at,
        'updated_at': challenge.updated_at,
    }


class ChallengeWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    period_unit = serializers.ChoiceField(
        choices=ChallengePeriodUnit.choices,
        default=ChallengePeriodUnit.WEEK,
    )
    duration = serializers.IntegerField(min_value=1, default=1)
    starts_on = serializers.DateField()
    shelf_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )

    def validate_shelf_ids(self, value):
        user = self.context['request'].user
        shelves = list(
            UserBook.objects.filter(user=user, pk__in=value).select_related('book')
        )
        if len(shelves) != len(set(value)):
            raise serializers.ValidationError(
                'بعضی از منابع انتخاب‌شده در قفسه‌ات نیستند.'
            )
        if not shelves:
            raise serializers.ValidationError(
                'حداقل یک کتاب، الکترونیک یا جزوه انتخاب کن.'
            )
        return [ub.book for ub in shelves]

    def validate_title(self, value):
        title = (value or '').strip()
        if not title:
            raise serializers.ValidationError('عنوان چالش را وارد کن.')
        return title


class ChallengeViewSet(ViewSet):
    def _get_challenge(self, request, pk):
        return get_object_or_404(get_challenge_queryset(request.user), pk=pk)

    def list(self, request):
        refresh_challenges_for_user(request.user)
        status_filter = request.query_params.get('status') or None
        challenges = get_challenges_by_status(request.user, status_filter)
        all_challenges = get_challenge_queryset(request.user)
        items = [
            serialize_challenge(ch, request, progress=compute_progress(ch))
            for ch in challenges
        ]
        return Response(
            {
                'results': items,
                'statuses': [
                    {'value': value, 'label': label} for value, label in ChallengeStatus.choices
                ],
                'period_units': [
                    {'value': value, 'label': label}
                    for value, label in ChallengePeriodUnit.choices
                ],
                'active_status': (
                    status_filter if status_filter in ChallengeStatus.values else ''
                ),
                'total_count': all_challenges.count(),
                'active_count': all_challenges.filter(status=ChallengeStatus.ACTIVE).count(),
                'completed_count': all_challenges.filter(
                    status=ChallengeStatus.COMPLETED
                ).count(),
            }
        )

    def retrieve(self, request, pk=None):
        challenge = self._get_challenge(request, pk)
        refresh_status(challenge)
        return Response(serialize_challenge(challenge, request))

    def create(self, request):
        serializer = ChallengeWriteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        challenge = create_challenge(
            request.user,
            title=data['title'],
            description=data.get('description') or '',
            period_unit=data['period_unit'],
            duration=data['duration'],
            starts_on=data['starts_on'],
            books=data['shelf_ids'],
        )
        challenge = self._get_challenge(request, challenge.pk)
        return Response(
            serialize_challenge(challenge, request),
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        challenge = self._get_challenge(request, pk)
        serializer = ChallengeWriteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        challenge = update_challenge(
            challenge,
            title=data['title'],
            description=data.get('description') or '',
            period_unit=data['period_unit'],
            duration=data['duration'],
            starts_on=data['starts_on'],
            books=data['shelf_ids'],
        )
        challenge = self._get_challenge(request, challenge.pk)
        return Response(serialize_challenge(challenge, request))

    def destroy(self, request, pk=None):
        challenge = self._get_challenge(request, pk)
        challenge.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
