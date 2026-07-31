from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views import View
from django.views.decorators.http import require_POST
from django.utils.decorators import method_decorator

from apps.books.forms import BookForm, BookProgressForm
from apps.books.models import Book, BookStatus, UserBook
from apps.books.services import get_books_by_status
from apps.books.services.catalog import (
    add_book_to_shelf,
    create_shelf_book,
    update_shelf_book,
)
from apps.books.services.matching import (
    find_duplicates,
    search_book_suggestions,
    serialize_match,
)


class BookListView(LoginRequiredMixin, View):
    template_name = 'books/book_list.html'

    def get(self, request):
        status = request.GET.get('status') or ''
        if status and status not in BookStatus.values:
            status = ''
        books = get_books_by_status(request.user)
        owned = UserBook.objects.filter(user=request.user)
        context = {
            'books': books,
            'statuses': BookStatus.choices,
            'active_status': status,
            'total_count': owned.count(),
            'reading_count': owned.filter(status=BookStatus.READING).count(),
            'finished_count': owned.filter(status=BookStatus.FINISHED).count(),
        }
        return render(request, self.template_name, context)


class BookSuggestView(LoginRequiredMixin, View):
    def get(self, request):
        mode = request.GET.get('mode') or 'search'
        if mode == 'match':
            title = request.GET.get('title') or ''
            author = request.GET.get('author') or ''
            exclude = request.GET.get('exclude')
            exclude_pk = int(exclude) if exclude and exclude.isdigit() else None
            matches = find_duplicates(
                title=title,
                author=author,
                owner=request.user,
                exclude_book_pk=exclude_pk,
            )
            return JsonResponse({'results': [serialize_match(m) for m in matches]})

        query = request.GET.get('q') or ''
        scope = request.GET.get('scope') or 'books'
        if scope not in {'books', 'authors'}:
            scope = 'books'
        results = search_book_suggestions(
            owner=request.user,
            query=query,
            scope=scope,
        )
        return JsonResponse({'results': results, 'scope': scope})


@method_decorator(require_POST, name='dispatch')
class BookAddToShelfView(LoginRequiredMixin, View):
    """Add an existing catalog book to the current user's shelf."""

    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        user_book, created = add_book_to_shelf(request.user, book)
        if created:
            messages.success(request, f'«{book.title}» به قفسه‌ات اضافه شد.')
        else:
            messages.info(request, f'«{book.title}» از قبل در قفسه‌ات بود.')
        return redirect('books:detail', pk=user_book.pk)


class BookCreateView(LoginRequiredMixin, View):
    template_name = 'books/book_form.html'

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': BookForm(user=request.user),
                'page_title': 'افزودن کتاب جدید',
                'suggest_url': reverse('books:suggest'),
            },
        )

    def post(self, request):
        form = BookForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            catalog_id = form.cleaned_data.get('catalog_book_id')
            if catalog_id:
                book = get_object_or_404(Book, pk=catalog_id)
                user_book, created = add_book_to_shelf(
                    request.user,
                    book,
                    current_page=form.cleaned_data.get('current_page') or 0,
                    status=form.cleaned_data.get('status') or BookStatus.WANT_TO_READ,
                    notes=form.cleaned_data.get('notes') or '',
                )
                if created:
                    messages.success(request, f'کتاب «{book.title}» به قفسه اضافه شد.')
                else:
                    messages.info(request, f'کتاب «{book.title}» از قبل در قفسه بود.')
                return redirect('books:detail', pk=user_book.pk)

            user_book, shelf_created, _catalog_created = create_shelf_book(
                request.user,
                title=form.cleaned_data['title'],
                author=form.cleaned_data['author'],
                total_pages=form.cleaned_data['total_pages'],
                current_page=form.cleaned_data.get('current_page') or 0,
                status=form.cleaned_data.get('status') or BookStatus.WANT_TO_READ,
                notes=form.cleaned_data.get('notes') or '',
                cover=form.cleaned_data.get('cover'),
            )
            if shelf_created:
                messages.success(request, f'کتاب «{user_book.title}» اضافه شد.')
            else:
                messages.info(request, f'کتاب «{user_book.title}» از قبل در قفسه بود.')
            return redirect('books:detail', pk=user_book.pk)

        return render(
            request,
            self.template_name,
            {
                'form': form,
                'page_title': 'افزودن کتاب جدید',
                'suggest_url': reverse('books:suggest'),
                'similar_matches': form.similar_matches,
                'existing_book': form.existing_shelf_book,
                'existing_catalog_book': form.existing_catalog_book,
            },
        )


class BookDetailView(LoginRequiredMixin, View):
    template_name = 'books/book_detail.html'

    def get(self, request, pk):
        user_book = get_object_or_404(
            UserBook.objects.filter(user=request.user)
            .select_related('book')
            .prefetch_related('entries'),
            pk=pk,
        )
        kind = request.GET.get('kind')
        media_type = request.GET.get('media')
        entries = user_book.entries.all()
        if kind:
            entries = entries.filter(kind=kind)
        if media_type:
            entries = entries.filter(media_type=media_type)

        context = {
            'book': user_book,
            'entries': entries,
            'progress_form': BookProgressForm(instance=user_book),
            'active_kind': kind or '',
            'active_media': media_type or '',
        }
        return render(request, self.template_name, context)


class BookUpdateView(LoginRequiredMixin, View):
    template_name = 'books/book_form.html'

    def get(self, request, pk):
        user_book = get_object_or_404(UserBook, pk=pk, user=request.user)
        return render(
            request,
            self.template_name,
            {
                'form': BookForm(
                    user=request.user,
                    user_book=user_book,
                    instance=user_book.book,
                ),
                'book': user_book,
                'page_title': f'ویرایش «{user_book.title}»',
                'suggest_url': reverse('books:suggest'),
            },
        )

    def post(self, request, pk):
        user_book = get_object_or_404(UserBook, pk=pk, user=request.user)
        form = BookForm(
            request.POST,
            request.FILES,
            user=request.user,
            user_book=user_book,
            instance=user_book.book,
        )
        if form.is_valid():
            try:
                user_book = update_shelf_book(
                    user_book,
                    title=form.cleaned_data['title'],
                    author=form.cleaned_data['author'],
                    total_pages=form.cleaned_data['total_pages'],
                    current_page=form.cleaned_data.get('current_page') or 0,
                    status=form.cleaned_data.get('status') or user_book.status,
                    notes=form.cleaned_data.get('notes') or '',
                    cover=form.cleaned_data.get('cover'),
                )
            except Exception as exc:
                from django.core.exceptions import ValidationError as DjangoValidationError

                if isinstance(exc, DjangoValidationError):
                    form.add_error(None, exc)
                else:
                    raise
            else:
                messages.success(request, 'کتاب با موفقیت به‌روزرسانی شد.')
                return redirect('books:detail', pk=user_book.pk)

        return render(
            request,
            self.template_name,
            {
                'form': form,
                'book': user_book,
                'page_title': f'ویرایش «{user_book.title}»',
                'suggest_url': reverse('books:suggest'),
                'similar_matches': form.similar_matches,
                'existing_book': form.existing_shelf_book,
                'existing_catalog_book': form.existing_catalog_book,
            },
        )


class BookDeleteView(LoginRequiredMixin, View):
    def post(self, request, pk):
        user_book = get_object_or_404(UserBook, pk=pk, user=request.user)
        title = user_book.title
        user_book.delete()
        messages.success(request, f'«{title}» از قفسه‌ات حذف شد.')
        return redirect('books:list')


class BookProgressUpdateView(LoginRequiredMixin, View):
    def post(self, request, pk):
        user_book = get_object_or_404(UserBook, pk=pk, user=request.user)
        form = BookProgressForm(request.POST, instance=user_book)
        if form.is_valid():
            form.save()
            messages.success(request, 'پیشرفت مطالعه به‌روزرسانی شد.')
        else:
            messages.error(request, 'به‌روزرسانی پیشرفت ممکن نشد.')
        return redirect(f"{reverse('books:detail', kwargs={'pk': pk})}#progress")
