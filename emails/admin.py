from django.contrib import admin

from .models import ChallengeEmailLog


@admin.register(ChallengeEmailLog)
class ChallengeEmailLogAdmin(admin.ModelAdmin):
    list_display = ('challenge', 'kind', 'to_email', 'sent_at')
    list_filter = ('kind',)
    search_fields = ('to_email', 'challenge__title')
    readonly_fields = ('challenge', 'kind', 'to_email', 'sent_at')
