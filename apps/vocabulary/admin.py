from django.contrib import admin

from apps.vocabulary.models import Word


@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    list_display = ('term', 'owner', 'has_usage', 'has_audio', 'updated_at')
    list_filter = ('owner',)
    search_fields = ('term', 'meaning', 'usage', 'owner__username')
    autocomplete_fields = ('owner',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(boolean=True, description='کاربرد')
    def has_usage(self, obj):
        return obj.has_usage

    @admin.display(boolean=True, description='تلفظ')
    def has_audio(self, obj):
        return obj.has_audio
