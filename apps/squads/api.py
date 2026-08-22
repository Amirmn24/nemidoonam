from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.books.models import Book
from apps.squads.models import (
    SquadMembership,
    SquadResource,
    SquadResourceKind,
    SquadRole,
    StudySquad,
)
from apps.squads.services import (
    ResourcePermissionError,
    ResourceValidationError,
    SquadServiceError,
    add_resource,
    create_squad,
    delete_resource,
    get_squad_resources,
    get_user_squads,
    join_squad_by_code,
    leave_squad,
)


def serialize_squad(squad: StudySquad, request, *, is_owner: bool = False):
    """سریالایز گروه مطالعه با جزئیات اعضا."""
    members = []
    user_role = None
    
    for membership in squad.memberships.all():
        members.append({
            'user_id': membership.user.pk,
            'username': membership.user.username,
            'role': membership.role,
            'role_display': membership.get_role_display(),
            'joined_at': membership.joined_at,
        })
        if membership.user_id == request.user.pk:
            user_role = membership.role
    
    data = {
        'id': squad.pk,
        'name': squad.name,
        'description': squad.description,
        'course': squad.course,
        'owner_id': squad.owner_id,
        'is_active': squad.is_active,
        'member_count': len(members),
        'members': members,
        'user_role': user_role,
        'created_at': squad.created_at,
        'updated_at': squad.updated_at,
    }
    
    if is_owner:
        data['invite_code'] = squad.invite_code
    
    return data


class SquadWriteSerializer(serializers.Serializer):
    """سریالایزر ایجاد گروه."""
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    course = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default='',
    )

    def validate_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('نام گروه را وارد کن.')
        return name


class JoinSquadSerializer(serializers.Serializer):
    """سریالایزر پیوستن به گروه با کد."""
    invite_code = serializers.CharField(max_length=20)

    def validate_invite_code(self, value):
        code = (value or '').strip()
        if not code:
            raise serializers.ValidationError('کد دعوت را وارد کن.')
        return code


def serialize_resource(resource: SquadResource, request):
    """سریالایز منبع گروه."""
    data = {
        'id': resource.pk,
        'squad_id': resource.squad_id,
        'added_by': {
            'id': resource.added_by.pk,
            'username': resource.added_by.username,
        },
        'kind': resource.kind,
        'kind_display': resource.get_kind_display(),
        'title': resource.title,
        'created_at': resource.created_at,
    }
    
    if resource.kind == SquadResourceKind.DOCUMENT:
        data['document'] = {
            'original_filename': resource.original_filename,
            'content_type': resource.content_type,
            'size_bytes': resource.size_bytes,
            'has_file': resource.has_file,
        }
    elif resource.kind == SquadResourceKind.NOTE:
        data['note_content'] = resource.note_content
    elif resource.kind == SquadResourceKind.LINK:
        data['url'] = resource.url
    elif resource.kind == SquadResourceKind.BOOK_REF:
        if resource.book:
            data['book'] = {
                'id': resource.book.pk,
                'title': resource.book.title,
                'author': resource.book.author,
                'resource_kind': resource.book.resource_kind,
                'resource_kind_display': resource.book.get_resource_kind_display(),
            }
        else:
            data['book'] = None
    
    return data


class ResourceWriteSerializer(serializers.Serializer):
    """سریالایزر افزودن منبع به گروه."""
    kind = serializers.ChoiceField(choices=SquadResourceKind.choices)
    title = serializers.CharField(max_length=255)
    
    storage_key = serializers.CharField(max_length=500, required=False, allow_blank=True)
    original_filename = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content_type = serializers.CharField(max_length=100, required=False, allow_blank=True)
    size_bytes = serializers.IntegerField(min_value=0, required=False, default=0)
    
    note_content = serializers.CharField(required=False, allow_blank=True)
    url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    book_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate_title(self, value):
        title = (value or '').strip()
        if not title:
            raise serializers.ValidationError('عنوان منبع را وارد کن.')
        return title

    def validate(self, data):
        kind = data.get('kind')
        
        if kind == SquadResourceKind.DOCUMENT:
            if not data.get('storage_key'):
                raise serializers.ValidationError({
                    'storage_key': 'برای منبع نوع فایل، storage_key الزامی است.'
                })
        elif kind == SquadResourceKind.NOTE:
            note = (data.get('note_content') or '').strip()
            if not note:
                raise serializers.ValidationError({
                    'note_content': 'محتوای یادداشت را وارد کن.'
                })
            data['note_content'] = note
        elif kind == SquadResourceKind.LINK:
            url = (data.get('url') or '').strip()
            if not url:
                raise serializers.ValidationError({
                    'url': 'آدرس لینک را وارد کن.'
                })
            data['url'] = url
        elif kind == SquadResourceKind.BOOK_REF:
            book_id = data.get('book_id')
            if not book_id:
                raise serializers.ValidationError({
                    'book_id': 'شناسه کتاب را وارد کن.'
                })
            try:
                data['book'] = Book.objects.get(pk=book_id)
            except Book.DoesNotExist:
                raise serializers.ValidationError({
                    'book_id': 'کتاب با این شناسه وجود ندارد.'
                })
        
        return data


class SquadViewSet(ViewSet):
    def _get_squad(self, request, pk):
        """گرفتن گروهی که کاربر عضوشه."""
        return get_object_or_404(get_user_squads(request.user), pk=pk)

    def list(self, request):
        """لیست همه گروه‌های کاربر."""
        squads = get_user_squads(request.user)
        
        items = []
        for squad in squads:
            membership = squad.memberships.filter(user=request.user).first()
            is_owner = membership and membership.role == SquadRole.OWNER
            items.append(serialize_squad(squad, request, is_owner=is_owner))
        
        return Response({
            'results': items,
            'total_count': len(items),
        })

    def retrieve(self, request, pk=None):
        """جزئیات یک گروه."""
        squad = self._get_squad(request, pk)
        membership = squad.memberships.filter(user=request.user).first()
        is_owner = membership and membership.role == SquadRole.OWNER
        return Response(serialize_squad(squad, request, is_owner=is_owner))

    def create(self, request):
        """ایجاد گروه جدید."""
        serializer = SquadWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            squad = create_squad(
                request.user,
                name=data['name'],
                description=data.get('description', ''),
                course=data.get('course', ''),
            )
        except SquadServiceError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        squad = self._get_squad(request, squad.pk)
        return Response(
            serialize_squad(squad, request, is_owner=True),
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'])
    def join(self, request):
        """پیوستن به گروه با کد دعوت."""
        serializer = JoinSquadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['invite_code']
        
        try:
            squad = join_squad_by_code(request.user, code)
        except SquadServiceError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        squad = self._get_squad(request, squad.pk)
        return Response(serialize_squad(squad, request, is_owner=False))

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """خروج از گروه."""
        squad = self._get_squad(request, pk)
        
        try:
            leave_squad(request.user, squad)
        except SquadServiceError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def resources(self, request, pk=None):
        """لیست منابع یک گروه."""
        squad = self._get_squad(request, pk)
        resources = get_squad_resources(squad)
        
        items = [serialize_resource(res, request) for res in resources]
        
        return Response({
            'results': items,
            'total_count': len(items),
            'resource_kinds': [
                {'value': value, 'label': label}
                for value, label in SquadResourceKind.choices
            ],
        })

    @action(detail=True, methods=['post'], url_path='resources/add')
    def add_resource(self, request, pk=None):
        """افزودن منبع جدید به گروه."""
        squad = self._get_squad(request, pk)
        
        serializer = ResourceWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            resource = add_resource(
                squad=squad,
                user=request.user,
                kind=data['kind'],
                title=data['title'],
                storage_key=data.get('storage_key', ''),
                original_filename=data.get('original_filename', ''),
                content_type=data.get('content_type', ''),
                size_bytes=data.get('size_bytes', 0),
                note_content=data.get('note_content', ''),
                url=data.get('url', ''),
                book=data.get('book'),
            )
        except (ResourcePermissionError, ResourceValidationError) as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        return Response(
            serialize_resource(resource, request),
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'], url_path='resources/(?P<resource_id>[^/.]+)')
    def delete_resource(self, request, pk=None, resource_id=None):
        """حذف یک منبع از گروه."""
        squad = self._get_squad(request, pk)
        
        try:
            resource = SquadResource.objects.get(pk=resource_id, squad=squad)
        except SquadResource.DoesNotExist:
            return Response(
                {'detail': 'منبع پیدا نشد.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        try:
            delete_resource(resource, request.user)
        except ResourcePermissionError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        return Response(status=status.HTTP_204_NO_CONTENT)
