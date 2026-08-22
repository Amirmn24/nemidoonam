from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.squads.models import SquadMembership, SquadRole, StudySquad
from apps.squads.services import (
    create_squad,
    get_user_squads,
    join_squad_by_code,
    leave_squad,
)
from apps.squads.services.squads import SquadServiceError


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
