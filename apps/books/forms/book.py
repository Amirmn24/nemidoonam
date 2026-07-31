from django import forms
from django.core.exceptions import ValidationError

from apps.books.models import Book, BookStatus, UserBook
from apps.books.services.matching import (
    find_duplicates,
    find_exact_catalog,
    find_exact_on_shelf,
    is_similar_duplicate,
)


class BookForm(forms.ModelForm):
    """Form for creating/updating a shelf item (catalog book + personal progress)."""

    confirm_similar = forms.BooleanField(
        required=False,
        initial=False,
        label='مطمئنم این کتاب جدید است و با موارد پیشنهادی فرق دارد',
    )
    # When set, add this catalog book to shelf instead of creating by typed fields
    catalog_book_id = forms.IntegerField(required=False, widget=forms.HiddenInput)

    class Meta:
        model = Book
        fields = [
            'title',
            'author',
            'total_pages',
            'cover',
        ]
        widgets = {
            'title': forms.TextInput(
                attrs={
                    'placeholder': 'مثلاً صد سال تنهایی',
                    'autocomplete': 'off',
                    'data-book-title': '1',
                }
            ),
            'author': forms.TextInput(
                attrs={
                    'placeholder': 'مثلاً گابریل گارسیا مارکز',
                    'autocomplete': 'off',
                    'data-book-author': '1',
                }
            ),
            'total_pages': forms.NumberInput(attrs={'min': 1}),
        }

    current_page = forms.IntegerField(
        label='صفحه فعلی',
        min_value=0,
        required=False,
        initial=0,
        widget=forms.NumberInput(attrs={'min': 0, 'class': 'field-input'}),
    )
    status = forms.ChoiceField(
        label='وضعیت',
        choices=BookStatus.choices,
        initial=BookStatus.WANT_TO_READ,
        widget=forms.Select(attrs={'class': 'field-select'}),
    )
    notes = forms.CharField(
        label='یادداشت کلی',
        required=False,
        widget=forms.Textarea(
            attrs={
                'rows': 3,
                'class': 'field-textarea',
                'placeholder': 'یادداشت کوتاه درباره این کتاب (اختیاری)',
            }
        ),
    )

    def __init__(self, *args, user=None, user_book: UserBook | None = None, **kwargs):
        self.user = user
        self.user_book = user_book
        self.similar_matches = []
        self.existing_shelf_book = None
        self.existing_catalog_book = None
        super().__init__(*args, **kwargs)

        if user_book:
            self.fields['current_page'].initial = user_book.current_page
            self.fields['status'].initial = user_book.status
            self.fields['notes'].initial = user_book.notes

        for name, field in self.fields.items():
            if name in {'confirm_similar', 'catalog_book_id'}:
                continue
            if field.widget.attrs.get('class'):
                continue
            css = 'field-input'
            if isinstance(field.widget, forms.Textarea):
                css = 'field-textarea'
            elif isinstance(field.widget, forms.Select):
                css = 'field-select'
            elif isinstance(field.widget, forms.ClearableFileInput):
                css = 'field-file'
            field.widget.attrs.setdefault('class', css)

    def clean_title(self):
        title = (self.cleaned_data.get('title') or '').strip()
        if not title:
            raise ValidationError('عنوان کتاب را وارد کن.')
        return title

    def clean_author(self):
        author = (self.cleaned_data.get('author') or '').strip()
        if not author:
            raise ValidationError('نام نویسنده را وارد کن.')
        return author

    def clean(self):
        cleaned = super().clean()
        total_pages = cleaned.get('total_pages')
        current_page = cleaned.get('current_page') or 0
        if total_pages is not None and current_page > total_pages:
            raise ValidationError({'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'})

        if not self.user:
            return cleaned

        catalog_id = cleaned.get('catalog_book_id')
        if catalog_id:
            book = Book.objects.filter(pk=catalog_id).first()
            if not book:
                raise ValidationError('کتاب انتخاب‌شده پیدا نشد.')
            self.existing_catalog_book = book
            shelf = UserBook.objects.filter(user=self.user, book=book).first()
            if shelf and (not self.user_book or shelf.pk != self.user_book.pk):
                self.existing_shelf_book = shelf
                raise ValidationError(
                    f'کتاب «{book.title}» از قبل در قفسه‌ات هست.'
                )
            return cleaned

        title = cleaned.get('title')
        author = cleaned.get('author')
        if not title or not author:
            return cleaned

        exclude_shelf = self.user_book.pk if self.user_book else None
        exclude_book = self.user_book.book_id if self.user_book else None

        on_shelf = find_exact_on_shelf(
            title=title,
            author=author,
            owner=self.user,
            exclude_shelf_pk=exclude_shelf,
        )
        if on_shelf:
            self.existing_shelf_book = on_shelf
            raise ValidationError(
                f'کتاب «{on_shelf.title}» از «{on_shelf.author}» از قبل در قفسه‌ات هست.'
            )

        catalog = find_exact_catalog(title, author)
        if catalog and (not exclude_book or catalog.pk != exclude_book):
            # Exact catalog hit → adding is fine; surface it for UX
            self.existing_catalog_book = catalog
            cleaned['catalog_book_id'] = catalog.pk

        matches = find_duplicates(
            title=title,
            author=author,
            owner=self.user,
            exclude_book_pk=exclude_book,
        )
        strong = [
            m
            for m in matches
            if is_similar_duplicate(title, author, m.book.title, m.book.author)
            and not m.is_exact
        ]
        self.similar_matches = strong or [m for m in matches if not m.is_exact][:5]
        if strong and not cleaned.get('confirm_similar'):
            sample = strong[0].book
            raise ValidationError(
                f'کتابی شبیه «{sample.title}» — {sample.author} در کتابخانه هست. '
                'اگر همان است از پیشنهادها انتخاب/اضافه کن؛ '
                'اگر کتاب دیگری است گزینه تأیید را بزن.'
            )
        return cleaned


class BookProgressForm(forms.ModelForm):
    class Meta:
        model = UserBook
        fields = ['current_page', 'status']
        widgets = {
            'current_page': forms.NumberInput(attrs={'min': 0, 'class': 'field-input'}),
            'status': forms.Select(attrs={'class': 'field-select'}),
        }

    def clean(self):
        cleaned = super().clean()
        current_page = cleaned.get('current_page')
        if (
            self.instance
            and self.instance.book_id
            and current_page is not None
            and current_page > self.instance.book.total_pages
        ):
            raise ValidationError({'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'})

        status = cleaned.get('status')
        if status == BookStatus.FINISHED and current_page is not None:
            cleaned['current_page'] = self.instance.book.total_pages
        return cleaned
