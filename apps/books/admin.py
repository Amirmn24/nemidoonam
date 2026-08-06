from django.contrib import admin

from apps.books.models import Book, BookRating, Entry, ReadingVibeLog, ReadingVibeProfile, UserBook


class EntryInline(admin.TabularInline):
    model = Entry
    extra = 0
    fields = (
        'kind',
        'media_type',
        'page_number',
        'entry_date',
        'is_public',
        'is_sealed',
        'text_content',
    )
    show_change_link = True


class BookRatingInline(admin.StackedInline):
    model = BookRating
    extra = 0
    max_num = 1
    fields = ('writing', 'content', 'characters', 'pacing', 'impact', 'review')
    readonly_fields = ()


class UserBookInline(admin.TabularInline):
    model = UserBook
    extra = 0
    autocomplete_fields = ('user',)
    fields = ('user', 'status', 'current_page', 'notes')
    show_change_link = True


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'total_pages',
        'updated_at',
    )
    search_fields = ('title', 'author')
    inlines = [UserBookInline]
    readonly_fields = ('title_normalized', 'author_normalized', 'created_at', 'updated_at')


@admin.register(UserBook)
class UserBookAdmin(admin.ModelAdmin):
    list_display = (
        'book',
        'user',
        'status',
        'current_page',
        'updated_at',
    )
    list_filter = ('status',)
    search_fields = ('book__title', 'book__author', 'user__username')
    autocomplete_fields = ('user', 'book')
    inlines = [EntryInline, BookRatingInline]
    readonly_fields = ('created_at', 'updated_at')
    fields = (
        'user',
        'book',
        'status',
        'current_page',
        'notes',
        'midpoint_prompt_done',
        'created_at',
        'updated_at',
    )


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = (
        'user_book',
        'kind',
        'media_type',
        'page_number',
        'is_public',
        'is_sealed',
        'entry_date',
        'created_at',
    )
    list_filter = ('kind', 'media_type', 'is_public', 'is_sealed', 'entry_date')
    search_fields = ('user_book__book__title', 'text_content')
    autocomplete_fields = ('user_book',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(BookRating)
class BookRatingAdmin(admin.ModelAdmin):
    list_display = ('user_book', 'overall_display', 'updated_at')
    search_fields = ('user_book__book__title', 'user_book__user__username')
    autocomplete_fields = ('user_book',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='نمره کلی')
    def overall_display(self, obj):
        return obj.overall_score


@admin.register(ReadingVibeProfile)
class ReadingVibeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'mood_label', 'updated_at')
    search_fields = ('user__username', 'mood_label', 'quote')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ReadingVibeLog)
class ReadingVibeLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'book_title', 'mood_label', 'created_at')
    search_fields = ('user__username', 'book_title', 'book_author', 'change_summary')
    autocomplete_fields = ('user', 'user_book')
    readonly_fields = ('created_at',)
