from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views import View

from apps.books.forms import BookForm, BookProgressForm
from apps.books.models import Book, BookStatus
from apps.books.services import get_books_by_status


class BookListView(LoginRequiredMixin, View):
    template_name = 'books/book_list.html'

    def get(self, request):
        status = request.GET.get('status')
        books = get_books_by_status(request.user, status)
        owned = Book.objects.filter(owner=request.user)
        context = {
            'books': books,
            'statuses': BookStatus.choices,
            'active_status': status or '',
            'total_count': owned.count(),
            'reading_count': owned.filter(status=BookStatus.READING).count(),
            'finished_count': owned.filter(status=BookStatus.FINISHED).count(),
        }
        return render(request, self.template_name, context)


class BookCreateView(LoginRequiredMixin, View):
    template_name = 'books/book_form.html'

    def get(self, request):
        return render(
            request,
            self.template_name,
            {'form': BookForm(), 'page_title': 'افزودن کتاب جدید'},
        )

    def post(self, request):
        form = BookForm(request.POST, request.FILES)
        if form.is_valid():
            book = form.save(commit=False)
            book.owner = request.user
            book.save()
            messages.success(request, f'کتاب «{book.title}» اضافه شد.')
            return redirect('books:detail', pk=book.pk)
        return render(
            request,
            self.template_name,
            {'form': form, 'page_title': 'افزودن کتاب جدید'},
        )


class BookDetailView(LoginRequiredMixin, View):
    template_name = 'books/book_detail.html'

    def get(self, request, pk):
        book = get_object_or_404(
            Book.objects.filter(owner=request.user).prefetch_related('entries'),
            pk=pk,
        )
        kind = request.GET.get('kind')
        media_type = request.GET.get('media')
        entries = book.entries.all()
        if kind:
            entries = entries.filter(kind=kind)
        if media_type:
            entries = entries.filter(media_type=media_type)

        context = {
            'book': book,
            'entries': entries,
            'progress_form': BookProgressForm(instance=book),
            'active_kind': kind or '',
            'active_media': media_type or '',
        }
        return render(request, self.template_name, context)


class BookUpdateView(LoginRequiredMixin, View):
    template_name = 'books/book_form.html'

    def get(self, request, pk):
        book = get_object_or_404(Book, pk=pk, owner=request.user)
        return render(
            request,
            self.template_name,
            {
                'form': BookForm(instance=book),
                'book': book,
                'page_title': f'ویرایش «{book.title}»',
            },
        )

    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk, owner=request.user)
        form = BookForm(request.POST, request.FILES, instance=book)
        if form.is_valid():
            book = form.save()
            messages.success(request, 'کتاب با موفقیت به‌روزرسانی شد.')
            return redirect('books:detail', pk=book.pk)
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'book': book,
                'page_title': f'ویرایش «{book.title}»',
            },
        )


class BookDeleteView(LoginRequiredMixin, View):
    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk, owner=request.user)
        title = book.title
        book.delete()
        messages.success(request, f'کتاب «{title}» حذف شد.')
        return redirect('books:list')


class BookProgressUpdateView(LoginRequiredMixin, View):
    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk, owner=request.user)
        form = BookProgressForm(request.POST, instance=book)
        if form.is_valid():
            form.save()
            messages.success(request, 'پیشرفت مطالعه به‌روزرسانی شد.')
        else:
            messages.error(request, 'به‌روزرسانی پیشرفت ممکن نشد.')
        return redirect(f"{reverse('books:detail', kwargs={'pk': pk})}#progress")
