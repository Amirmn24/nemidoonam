from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.books.models.highlight import DEFAULT_HIGHLIGHT_COLOR
from apps.books.services.books import get_shelf_queryset
from apps.books.services.highlights import (
    create_highlight,
    delete_highlight,
    list_highlights,
    normalize_color,
    serialize_highlight,
    update_highlight,
)


class HighlightWriteSerializer(serializers.Serializer):
    page_number = serializers.IntegerField(min_value=1)
    color = serializers.CharField(required=False, default=DEFAULT_HIGHLIGHT_COLOR, max_length=16)
    quote = serializers.CharField(required=False, allow_blank=True, default='', max_length=4000)
    note = serializers.CharField(required=False, allow_blank=True, default='', max_length=500)
    rects = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_color(self, value):
        return normalize_color(value)


class HighlightPatchSerializer(serializers.Serializer):
    color = serializers.CharField(required=False, max_length=16)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        if 'color' not in attrs and 'note' not in attrs:
            raise serializers.ValidationError('حداقل یکی از color یا note لازم است.')
        return attrs

    def validate_color(self, value):
        return normalize_color(value)


def _document_for_shelf(request, pk):
    from apps.books.models.document import UserBookDocument

    user_book = get_object_or_404(
        get_shelf_queryset(request.user).select_related('document'),
        pk=pk,
    )
    try:
        doc = user_book.document
    except UserBookDocument.DoesNotExist:
        return user_book, None
    if not doc.has_file:
        return user_book, None
    return user_book, doc


class ShelfDocumentHighlightListView(APIView):
    """لیست/ایجاد هایلایت — فایل PDF بازنویسی نمی‌شود."""

    def get(self, request, pk):
        _ub, doc = _document_for_shelf(request, pk)
        if doc is None:
            return Response({'results': []})
        return Response({'results': [serialize_highlight(h) for h in list_highlights(doc)]})

    def post(self, request, pk):
        _ub, doc = _document_for_shelf(request, pk)
        if doc is None:
            return Response({'detail': 'سندی برای هایلایت نیست.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = HighlightWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            hl = create_highlight(
                doc,
                page_number=data['page_number'],
                rects=data['rects'],
                color=data.get('color') or DEFAULT_HIGHLIGHT_COLOR,
                quote=data.get('quote') or '',
                note=data.get('note') or '',
            )
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, 'messages') else str(exc)
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serialize_highlight(hl), status=status.HTTP_201_CREATED)


class ShelfDocumentHighlightDetailView(APIView):
    def _get(self, request, pk, highlight_id):
        _ub, doc = _document_for_shelf(request, pk)
        if doc is None:
            return None, Response({'detail': 'سندی پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
        hl = get_object_or_404(doc.highlights, pk=highlight_id)
        return hl, None

    def patch(self, request, pk, highlight_id):
        hl, err = self._get(request, pk, highlight_id)
        if err:
            return err
        serializer = HighlightPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            hl = update_highlight(
                hl,
                color=serializer.validated_data.get('color'),
                note=serializer.validated_data.get('note'),
            )
        except DjangoValidationError as exc:
            message = exc.messages[0] if hasattr(exc, 'messages') else str(exc)
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serialize_highlight(hl))

    def delete(self, request, pk, highlight_id):
        hl, err = self._get(request, pk, highlight_id)
        if err:
            return err
        delete_highlight(hl)
        return Response(status=status.HTTP_204_NO_CONTENT)
