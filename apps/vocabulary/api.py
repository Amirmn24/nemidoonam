from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.vocabulary.services.words import (
    create_word,
    get_word_queryset,
    update_word,
)


class WordSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    term = serializers.CharField()
    meaning = serializers.CharField()
    usage = serializers.CharField()
    audio_url = serializers.SerializerMethodField()
    has_usage = serializers.BooleanField()
    has_audio = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    def get_audio_url(self, obj):
        if not obj.audio:
            return None
        request = self.context.get('request')
        url = obj.audio.url
        return request.build_absolute_uri(url) if request else url


class WordWriteSerializer(serializers.Serializer):
    term = serializers.CharField(max_length=200)
    meaning = serializers.CharField()
    usage = serializers.CharField(required=False, allow_blank=True, default='')
    audio = serializers.FileField(required=False, allow_null=True)
    clear_audio = serializers.BooleanField(required=False, default=False)

    def validate_term(self, value):
        term = (value or '').strip()
        if not term:
            raise serializers.ValidationError('واژه را وارد کن.')
        return term

    def validate_meaning(self, value):
        meaning = (value or '').strip()
        if not meaning:
            raise serializers.ValidationError('معنی را وارد کن.')
        return meaning

    def validate_usage(self, value):
        return (value or '').strip()


class WordViewSet(ViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_word(self, request, pk):
        return get_object_or_404(get_word_queryset(request.user), pk=pk)

    def list(self, request):
        qs = get_word_queryset(request.user)
        query = (request.query_params.get('q') or '').strip()
        if query:
            qs = qs.filter(Q(term__icontains=query) | Q(meaning__icontains=query))
        all_words = get_word_queryset(request.user)
        return Response(
            {
                'results': WordSerializer(qs, many=True, context={'request': request}).data,
                'total_count': all_words.count(),
                'with_audio_count': all_words.exclude(audio='').exclude(audio=None).count(),
                'query': query,
            }
        )

    def retrieve(self, request, pk=None):
        word = self._get_word(request, pk)
        return Response(WordSerializer(word, context={'request': request}).data)

    def create(self, request):
        serializer = WordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        word = create_word(
            request.user,
            term=data['term'],
            meaning=data['meaning'],
            usage=data.get('usage') or '',
            audio=data.get('audio'),
        )
        return Response(
            WordSerializer(word, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        word = self._get_word(request, pk)
        serializer = WordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        word = update_word(
            word,
            term=data['term'],
            meaning=data['meaning'],
            usage=data.get('usage') or '',
            audio=data.get('audio'),
            clear_audio=bool(data.get('clear_audio')),
        )
        return Response(WordSerializer(word, context={'request': request}).data)

    def destroy(self, request, pk=None):
        word = self._get_word(request, pk)
        if word.audio:
            word.audio.delete(save=False)
        word.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
