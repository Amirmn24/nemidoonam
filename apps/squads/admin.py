from django.contrib import admin

from apps.squads.models import SquadMembership, StudySquad


class SquadMembershipInline(admin.TabularInline):
    model = SquadMembership
    extra = 0
    autocomplete_fields = ('user',)
    fields = ('user', 'role', 'joined_at')
    readonly_fields = ('joined_at',)


@admin.register(StudySquad)
class StudySquadAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'owner',
        'course',
        'is_active',
        'invite_code',
        'created_at',
        'updated_at',
    )
    list_filter = ('is_active', 'owner')
    search_fields = ('name', 'owner__username', 'description', 'course', 'invite_code')
    autocomplete_fields = ('owner',)
    inlines = [SquadMembershipInline]
    readonly_fields = ('invite_code', 'created_at', 'updated_at')


@admin.register(SquadMembership)
class SquadMembershipAdmin(admin.ModelAdmin):
    list_display = ('squad', 'user', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('squad__name', 'user__username')
    autocomplete_fields = ('squad', 'user')
    readonly_fields = ('joined_at',)
