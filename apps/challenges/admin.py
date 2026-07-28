from django.contrib import admin

from apps.challenges.models import Challenge, ChallengeBook


class ChallengeBookInline(admin.TabularInline):
    model = ChallengeBook
    extra = 0
    autocomplete_fields = ('book',)
    fields = ('book', 'target_pages')


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'owner',
        'status',
        'period_unit',
        'duration',
        'starts_on',
        'ends_on',
        'updated_at',
    )
    list_filter = ('status', 'period_unit', 'owner')
    search_fields = ('title', 'owner__username', 'description')
    autocomplete_fields = ('owner',)
    inlines = [ChallengeBookInline]
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ChallengeBook)
class ChallengeBookAdmin(admin.ModelAdmin):
    list_display = ('challenge', 'book', 'target_pages', 'created_at')
    search_fields = ('challenge__title', 'book__title')
    autocomplete_fields = ('challenge', 'book')
