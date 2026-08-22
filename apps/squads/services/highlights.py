from __future__ import annotations

from django.db import transaction
from django.db.models import QuerySet

from apps.squads.models import (
    SquadMembership,
    SquadResource,
    SquadResourceHighlight,
    SquadResourceKind,
)


class HighlightPermissionError(PermissionError):
    """خطای دسترسی به هایلایت."""
    pass


class HighlightValidationError(Exception):
    """خطای اعتبارسنجی هایلایت."""
    pass


def _check_resource_is_document(resource: SquadResource) -> None:
    """چک می‌کنه که منبع از نوع document باشه."""
    if resource.kind != SquadResourceKind.DOCUMENT:
        raise HighlightValidationError(
            'فقط می‌تونی روی منابع نوع فایل سند هایلایت بزنی.'
        )


def _check_squad_membership(resource: SquadResource, user) -> SquadMembership:
    """چک می‌کنه که کاربر عضو گروه باشه."""
    try:
        return SquadMembership.objects.get(squad=resource.squad, user=user)
    except SquadMembership.DoesNotExist:
        raise HighlightPermissionError('تو عضو این گروه نیستی.')


def get_resource_highlights(resource: SquadResource) -> QuerySet[SquadResourceHighlight]:
    """همه هایلایت‌های همه اعضا روی این منبع."""
    _check_resource_is_document(resource)
    
    return (
        SquadResourceHighlight.objects.filter(resource=resource)
        .select_related('owner', 'resource', 'resource__squad')
        .order_by('page_number', 'created_at')
    )


@transaction.atomic
def add_highlight(
    resource: SquadResource,
    user,
    *,
    page_number: int,
    rects: list,
    quote: str = '',
    note: str = '',
) -> SquadResourceHighlight:
    """
    افزودن هایلایت جدید روی سند گروهی.
    
    کاربر باید عضو گروه باشه و منبع باید document باشه.
    """
    _check_resource_is_document(resource)
    _check_squad_membership(resource, user)
    
    if page_number < 1:
        raise HighlightValidationError('شماره صفحه باید حداقل ۱ باشه.')
    
    if not isinstance(rects, list) or len(rects) == 0:
        raise HighlightValidationError('مختصات مستطیل‌ها را وارد کن.')
    
    highlight = SquadResourceHighlight.objects.create(
        resource=resource,
        owner=user,
        page_number=page_number,
        rects=rects,
        quote=(quote or '').strip(),
        note=(note or '').strip(),
    )
    
    return highlight


@transaction.atomic
def delete_highlight(highlight: SquadResourceHighlight, user) -> None:
    """
    حذف هایلایت.
    
    فقط owner خودش اجازه داره.
    """
    if highlight.owner_id != user.pk:
        raise HighlightPermissionError('فقط خودت می‌تونی هایلایت خودت رو حذف کنی.')
    
    highlight.delete()
