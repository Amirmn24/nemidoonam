from django.contrib import admin

from apps.squads.models import SquadMembership, SquadResource, StudySquad


class SquadMembershipInline(admin.TabularInline):
    model = SquadMembership
    extra = 0
    autocomplete_fields = ('user',)
    fields = ('user', 'role', 'joined_at')
    readonly_fields = ('joined_at',)


class SquadResourceInline(admin.TabularInline):
    model = SquadResource
    extra = 0
    autocomplete_fields = ('added_by', 'book')
    fields = ('kind', 'title', 'added_by', 'created_at')
    readonly_fields = ('created_at',)


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
    inlines = [SquadMembershipInline, SquadResourceInline]
    readonly_fields = ('invite_code', 'created_at', 'updated_at')


@admin.register(SquadMembership)
class SquadMembershipAdmin(admin.ModelAdmin):
    list_display = ('squad', 'user', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('squad__name', 'user__username')
    autocomplete_fields = ('squad', 'user')
    readonly_fields = ('joined_at',)


@admin.register(SquadResource)
class SquadResourceAdmin(admin.ModelAdmin):
    list_display = ('title', 'squad', 'kind', 'added_by', 'created_at')
    list_filter = ('kind', 'created_at')
    search_fields = ('title', 'squad__name', 'added_by__username')
    autocomplete_fields = ('squad', 'added_by', 'book')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('اطلاعات پایه', {
            'fields': ('squad', 'added_by', 'kind', 'title', 'created_at')
        }),
        ('فایل سند', {
            'fields': ('storage_key', 'original_filename', 'content_type', 'size_bytes'),
            'classes': ('collapse',),
        }),
        ('یادداشت', {
            'fields': ('note_content',),
            'classes': ('collapse',),
        }),
        ('لینک', {
            'fields': ('url',),
            'classes': ('collapse',),
        }),
        ('منبع از کاتالوگ', {
            'fields': ('book',),
            'classes': ('collapse',),
        }),
    )
