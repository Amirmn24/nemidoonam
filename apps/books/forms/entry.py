from django import forms
from django.core.exceptions import ValidationError

from apps.books.models import Entry, EntryMediaType


class EntryForm(forms.ModelForm):
    class Meta:
        model = Entry
        fields = [
            'kind',
            'media_type',
            'page_number',
            'entry_date',
            'text_content',
            'image',
            'audio',
        ]
        widgets = {
            'kind': forms.Select(),
            'media_type': forms.Select(),
            'page_number': forms.NumberInput(attrs={'min': 1}),
            'entry_date': forms.DateInput(attrs={'type': 'date'}),
            'text_content': forms.Textarea(
                attrs={
                    'rows': 5,
                    'placeholder': 'متن دیدگاه، حس یا بخشی از کتاب را بنویسید…',
                }
            ),
        }

    def __init__(self, *args, book=None, **kwargs):
        self.book = book
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

        if book and not self.is_bound and not self.instance.pk:
            self.fields['page_number'].initial = max(book.current_page, 1)

    def clean(self):
        cleaned = super().clean()
        media_type = cleaned.get('media_type')
        text_content = (cleaned.get('text_content') or '').strip()
        image = cleaned.get('image')
        audio = cleaned.get('audio')
        page_number = cleaned.get('page_number')

        if self.book and page_number and page_number > self.book.total_pages:
            raise ValidationError(
                {'page_number': 'شماره صفحه نمی‌تواند بیشتر از تعداد صفحات کتاب باشد.'}
            )

        if media_type == EntryMediaType.TEXT and not text_content:
            raise ValidationError({'text_content': 'برای محتوای متنی، نوشتن متن الزامی است.'})
        if media_type == EntryMediaType.IMAGE and not image and not (self.instance and self.instance.image):
            raise ValidationError({'image': 'برای محتوای تصویری، آپلود تصویر الزامی است.'})
        if media_type == EntryMediaType.VOICE and not audio and not (self.instance and self.instance.audio):
            raise ValidationError({'audio': 'برای محتوای صوتی، آپلود ویس الزامی است.'})

        cleaned['text_content'] = text_content
        return cleaned

    def save(self, commit=True):
        entry = super().save(commit=False)
        if self.book is not None:
            entry.book = self.book
        if commit:
            entry.save()
        return entry
