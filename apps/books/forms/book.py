from django import forms
from django.core.exceptions import ValidationError

from apps.books.models import Book, BookStatus


class BookForm(forms.ModelForm):
    class Meta:
        model = Book
        fields = [
            'title',
            'author',
            'total_pages',
            'current_page',
            'status',
            'cover',
            'notes',
        ]
        widgets = {
            'title': forms.TextInput(attrs={'placeholder': 'مثلاً صد سال تنهایی'}),
            'author': forms.TextInput(attrs={'placeholder': 'مثلاً گابریل گارسیا مارکز'}),
            'total_pages': forms.NumberInput(attrs={'min': 1}),
            'current_page': forms.NumberInput(attrs={'min': 0}),
            'status': forms.Select(),
            'notes': forms.Textarea(
                attrs={
                    'rows': 3,
                    'placeholder': 'یادداشت کوتاه درباره این کتاب (اختیاری)',
                }
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            css = 'field-input'
            if isinstance(field.widget, forms.Textarea):
                css = 'field-textarea'
            elif isinstance(field.widget, forms.Select):
                css = 'field-select'
            elif isinstance(field.widget, forms.ClearableFileInput):
                css = 'field-file'
            field.widget.attrs.setdefault('class', css)

    def clean(self):
        cleaned = super().clean()
        total_pages = cleaned.get('total_pages')
        current_page = cleaned.get('current_page')
        if total_pages is not None and current_page is not None and current_page > total_pages:
            raise ValidationError({'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'})
        return cleaned


class BookProgressForm(forms.ModelForm):
    class Meta:
        model = Book
        fields = ['current_page', 'status']
        widgets = {
            'current_page': forms.NumberInput(attrs={'min': 0, 'class': 'field-input'}),
            'status': forms.Select(attrs={'class': 'field-select'}),
        }

    def clean(self):
        cleaned = super().clean()
        current_page = cleaned.get('current_page')
        if self.instance and current_page is not None and current_page > self.instance.total_pages:
            raise ValidationError({'current_page': 'صفحه فعلی نمی‌تواند بیشتر از تعداد صفحات باشد.'})

        status = cleaned.get('status')
        if status == BookStatus.FINISHED and current_page is not None:
            cleaned['current_page'] = self.instance.total_pages
        return cleaned
