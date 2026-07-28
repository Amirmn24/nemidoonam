from django import forms
from django.utils import timezone

from apps.books.models import Book
from apps.challenges.models import Challenge
from apps.challenges.services import compute_ends_on


class ChallengeForm(forms.ModelForm):
    books = forms.ModelMultipleChoiceField(
        label='کتاب‌ها',
        queryset=Book.objects.none(),
        widget=forms.CheckboxSelectMultiple,
        help_text='حداقل یک کتاب از قفسه خودت انتخاب کن.',
    )

    class Meta:
        model = Challenge
        fields = [
            'title',
            'description',
            'period_unit',
            'duration',
            'starts_on',
        ]
        widgets = {
            'title': forms.TextInput(attrs={'placeholder': 'مثلاً چالش بهار'}),
            'description': forms.Textarea(
                attrs={
                    'rows': 3,
                    'placeholder': 'هدف یا یادداشت کوتاه (اختیاری)',
                }
            ),
            'period_unit': forms.Select(),
            'duration': forms.NumberInput(attrs={'min': 1}),
            'starts_on': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, user, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        self.fields['books'].queryset = Book.objects.filter(owner=user).order_by(
            'title'
        )
        if self.instance and self.instance.pk:
            self.fields['books'].initial = self.instance.books.all()
        else:
            self.fields['starts_on'].initial = timezone.localdate()

        for name, field in self.fields.items():
            if name == 'books':
                continue
            css = 'field-input'
            if isinstance(field.widget, forms.Textarea):
                css = 'field-textarea'
            elif isinstance(field.widget, forms.Select):
                css = 'field-select'
            field.widget.attrs.setdefault('class', css)

        self.fields['period_unit'].label = 'واحد زمان'
        self.fields['duration'].label = 'مدت'
        self.fields['starts_on'].label = 'تاریخ شروع'

    def clean_books(self):
        books = self.cleaned_data['books']
        if not books.exists():
            raise forms.ValidationError('حداقل یک کتاب انتخاب کن.')
        invalid = books.exclude(owner=self.user)
        if invalid.exists():
            raise forms.ValidationError('فقط کتاب‌های خودت را می‌توانی انتخاب کنی.')
        return books

    def clean(self):
        cleaned = super().clean()
        period_unit = cleaned.get('period_unit')
        duration = cleaned.get('duration')
        starts_on = cleaned.get('starts_on')
        if period_unit and duration and starts_on:
            try:
                cleaned['ends_on'] = compute_ends_on(starts_on, period_unit, duration)
            except ValueError as exc:
                raise forms.ValidationError(str(exc)) from exc
        return cleaned
