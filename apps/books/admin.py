from django.contrib import admin

from apps.books.models import Book, Entry


class EntryInline(admin.TabularInline):
    model = Entry
    extra = 0
    fields = ('kind', 'media_type', 'page_number', 'entry_date', 'text_content')
    show_change_link = True


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'owner',
        'status',
        'current_page',
        'total_pages',
        'updated_at',
    )
    list_filter = ('status', 'owner')
    search_fields = ('title', 'author', 'owner__username')
    autocomplete_fields = ('owner',)
    inlines = [EntryInline]
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = (
        'book',
        'kind',
        'media_type',
        'page_number',
        'entry_date',
        'created_at',
    )
    list_filter = ('kind', 'media_type', 'entry_date')
    search_fields = ('book__title', 'text_content')
    autocomplete_fields = ('book',)
    readonly_fields = ('created_at', 'updated_at')
