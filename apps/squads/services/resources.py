from __future__ import annotations

from django.db import transaction
from django.db.models import QuerySet

from apps.squads.models import (
    SquadMembership,
    SquadResource,
    SquadResourceKind,
    SquadRole,
    StudySquad,
)


class ResourcePermissionError(PermissionError):
    """خطای دسترسی به منبع گروه."""
    pass


class ResourceValidationError(Exception):
    """خطای اعتبارسنجی منبع."""
    pass


def _check_squad_membership(squad: StudySquad, user) -> SquadMembership:
    """چک می‌کنه که کاربر عضو گروه باشه."""
    try:
        return SquadMembership.objects.get(squad=squad, user=user)
    except SquadMembership.DoesNotExist:
        raise ResourcePermissionError('تو عضو این گروه نیستی.')


def get_squad_resources(squad: StudySquad) -> QuerySet[SquadResource]:
    """همه منابع یک گروه."""
    return (
        SquadResource.objects.filter(squad=squad)
        .select_related('added_by', 'book', 'squad')
        .order_by('-created_at')
    )


@transaction.atomic
def add_resource(
    squad: StudySquad,
    user,
    kind: str,
    title: str,
    *,
    storage_key: str = '',
    original_filename: str = '',
    content_type: str = '',
    size_bytes: int = 0,
    note_content: str = '',
    url: str = '',
    book=None,
) -> SquadResource:
    """
    افزودن منبع جدید به گروه.
    
    کاربر باید عضو گروه باشه.
    بسته به kind، فیلدهای متناسب رو چک می‌کنه.
    """
    _check_squad_membership(squad, user)
    
    title = (title or '').strip()
    if not title:
        raise ResourceValidationError('عنوان منبع را وارد کن.')
    
    if kind not in SquadResourceKind.values:
        raise ResourceValidationError('نوع منبع نامعتبر است.')
    
    if kind == SquadResourceKind.DOCUMENT:
        if not storage_key:
            raise ResourceValidationError('فایل سند الزامی است.')
    elif kind == SquadResourceKind.NOTE:
        note_content = (note_content or '').strip()
        if not note_content:
            raise ResourceValidationError('محتوای یادداشت را وارد کن.')
    elif kind == SquadResourceKind.LINK:
        url = (url or '').strip()
        if not url:
            raise ResourceValidationError('آدرس لینک را وارد کن.')
    elif kind == SquadResourceKind.BOOK_REF:
        if book is None:
            raise ResourceValidationError('کتاب مرجع را انتخاب کن.')
    
    resource = SquadResource.objects.create(
        squad=squad,
        added_by=user,
        kind=kind,
        title=title,
        storage_key=storage_key or '',
        original_filename=original_filename or '',
        content_type=content_type or '',
        size_bytes=size_bytes,
        note_content=note_content or '',
        url=url or '',
        book=book,
    )
    
    return resource


@transaction.atomic
def delete_resource(resource: SquadResource, user) -> None:
    """
    حذف منبع.
    
    فقط added_by یا owner گروه اجازه داره.
    """
    membership = _check_squad_membership(resource.squad, user)
    
    is_owner = membership.role == SquadRole.OWNER
    is_creator = resource.added_by_id == user.pk
    
    if not (is_owner or is_creator):
        raise ResourcePermissionError(
            'فقط سازنده منبع یا مالک گروه می‌تونه این منبع رو حذف کنه.'
        )
    
    resource.delete()
