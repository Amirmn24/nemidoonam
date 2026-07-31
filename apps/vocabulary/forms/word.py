from django import forms

from apps.vocabulary.models import Word


class WordForm(forms.ModelForm):
    class Meta:
        model = Word
        fields = ['term', 'meaning', 'usage', 'audio']
        widgets = {
            'term': forms.TextInput(attrs={'placeholder': 'مثلاً ephemeral'}),
            'meaning': forms.Textarea(
                attrs={
                    'rows': 3,
                    'placeholder': 'معنی واژه را بنویس…',
                }
            ),
            'usage': forms.Textarea(
                attrs={
                    'rows': 3,
                    'placeholder': 'جمله‌ای که واژه در آن به کار رفته (اختیاری)',
                }
            ),
            'audio': forms.FileInput(
                attrs={'accept': 'audio/*,.webm,.ogg,.m4a,.mp3'}
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['usage'].required = False
        self.fields['audio'].required = False

        for name, field in self.fields.items():
            css = 'field-input'
            if isinstance(field.widget, forms.Textarea):
                css = 'field-textarea'
            elif isinstance(field.widget, forms.FileInput):
                css = 'field-file'
            field.widget.attrs.setdefault('class', css)

    def clean_term(self):
        term = (self.cleaned_data.get('term') or '').strip()
        if not term:
            raise forms.ValidationError('واژه را وارد کن.')
        return term

    def clean_meaning(self):
        meaning = (self.cleaned_data.get('meaning') or '').strip()
        if not meaning:
            raise forms.ValidationError('معنی واژه الزامی است.')
        return meaning

    def clean_usage(self):
        usage = self.cleaned_data.get('usage') or ''
        return usage.strip()
