from __future__ import annotations

from django.db import transaction
from django.db.models import Prefetch, QuerySet

from apps.squads.models import SquadMembership, SquadRole, StudySquad


class SquadServiceError(Exception):
    """خطای منطق سرویس گروه مطالعه."""
    pass


def get_squad_queryset(user) -> QuerySet[StudySquad]:
    """کوئری‌ست گروه‌های قابل دسترسی برای کاربر."""
    return (
        StudySquad.objects.filter(
            memberships__user=user,
            is_active=True,
        )
        .prefetch_related(
            Prefetch(
                'memberships',
                queryset=SquadMembership.objects.select_related('user'),
            )
        )
        .distinct()
    )


def get_user_squads(user) -> QuerySet[StudySquad]:
    """همه گروه‌های فعالی که کاربر عضوشونه."""
    return get_squad_queryset(user)


@transaction.atomic
def create_squad(
    user,
    *,
    name: str,
    description: str = '',
    course: str = '',
) -> StudySquad:
    """
    ایجاد گروه جدید و افزودن سازنده به‌عنوان owner.
    
    کد دعوت خودکار در save مدل تولید می‌شه.
    """
    name = (name or '').strip()
    if not name:
        raise SquadServiceError('نام گروه را وارد کن.')
    
    squad = StudySquad.objects.create(
        name=name,
        description=(description or '').strip(),
        course=(course or '').strip(),
        owner=user,
    )
    
    SquadMembership.objects.create(
        squad=squad,
        user=user,
        role=SquadRole.OWNER,
    )
    
    return squad


@transaction.atomic
def join_squad_by_code(user, code: str) -> StudySquad:
    """
    پیوستن به گروه با کد دعوت.
    
    اگر قبلاً عضو بود، فقط squad رو برمی‌گردونه.
    """
    code = (code or '').strip()
    if not code:
        raise SquadServiceError('کد دعوت را وارد کن.')
    
    try:
        squad = StudySquad.objects.get(invite_code=code, is_active=True)
    except StudySquad.DoesNotExist:
        raise SquadServiceError('کد دعوت نامعتبر یا منقضی شده است.')
    
    membership, created = SquadMembership.objects.get_or_create(
        squad=squad,
        user=user,
        defaults={'role': SquadRole.MEMBER},
    )
    
    if not created:
        if membership.role == SquadRole.OWNER:
            raise SquadServiceError('تو مالک این گروه هستی.')
        raise SquadServiceError('قبلاً عضو این گروه شدی.')
    
    return squad


@transaction.atomic
def leave_squad(user, squad: StudySquad) -> None:
    """
    خروج کاربر از گروه.
    
    اگر owner باشه و عضو دیگه‌ای هست، ارور می‌ده.
    اگر آخرین نفر باشه، گروه رو غیرفعال می‌کنه.
    """
    try:
        membership = SquadMembership.objects.get(squad=squad, user=user)
    except SquadMembership.DoesNotExist:
        raise SquadServiceError('تو عضو این گروه نیستی.')
    
    all_members = SquadMembership.objects.filter(squad=squad)
    member_count = all_members.count()
    
    if membership.role == SquadRole.OWNER:
        if member_count > 1:
            raise SquadServiceError(
                'مالک گروه نمی‌تونه خارج بشه تا زمانی که عضو دیگه‌ای هست. '
                'ابتدا همه اعضا رو حذف کن.'
            )
        membership.delete()
        squad.is_active = False
        squad.save(update_fields=['is_active', 'updated_at'])
    else:
        membership.delete()
        if member_count == 1:
            squad.is_active = False
            squad.save(update_fields=['is_active', 'updated_at'])
