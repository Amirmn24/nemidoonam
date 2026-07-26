from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from apps.books.forms import EntryForm
from apps.books.models import Book, Entry


class EntryCreateView(LoginRequiredMixin, View):
    template_name = 'books/entry_form.html'

    def get(self, request, book_pk):
        book = get_object_or_404(Book, pk=book_pk, owner=request.user)
        return render(
            request,
            self.template_name,
            {
                'form': EntryForm(book=book),
                'book': book,
                'page_title': 'افزودن یادداشت',
            },
        )

    def post(self, request, book_pk):
        book = get_object_or_404(Book, pk=book_pk, owner=request.user)
        form = EntryForm(request.POST, request.FILES, book=book)
        if form.is_valid():
            entry = form.save()
            messages.success(request, 'یادداشت اضافه شد.')
            if entry.page_number > book.current_page:
                book.current_page = entry.page_number
                book.save(update_fields=['current_page', 'updated_at'])
            return redirect('books:detail', pk=book.pk)
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'book': book,
                'page_title': 'افزودن یادداشت',
            },
        )


class EntryUpdateView(LoginRequiredMixin, View):
    template_name = 'books/entry_form.html'

    def get(self, request, book_pk, pk):
        book = get_object_or_404(Book, pk=book_pk, owner=request.user)
        entry = get_object_or_404(Entry, pk=pk, book=book)
        return render(
            request,
            self.template_name,
            {
                'form': EntryForm(instance=entry, book=book),
                'book': book,
                'entry': entry,
                'page_title': 'ویرایش یادداشت',
            },
        )

    def post(self, request, book_pk, pk):
        book = get_object_or_404(Book, pk=book_pk, owner=request.user)
        entry = get_object_or_404(Entry, pk=pk, book=book)
        form = EntryForm(request.POST, request.FILES, instance=entry, book=book)
        if form.is_valid():
            form.save()
            messages.success(request, 'یادداشت به‌روزرسانی شد.')
            return redirect('books:detail', pk=book.pk)
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'book': book,
                'entry': entry,
                'page_title': 'ویرایش یادداشت',
            },
        )


class EntryDeleteView(LoginRequiredMixin, View):
    def post(self, request, book_pk, pk):
        book = get_object_or_404(Book, pk=book_pk, owner=request.user)
        entry = get_object_or_404(Entry, pk=pk, book=book)
        entry.delete()
        messages.success(request, 'یادداشت حذف شد.')
        return redirect('books:detail', pk=book.pk)
