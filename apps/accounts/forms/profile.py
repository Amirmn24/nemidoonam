from django import forms

from apps.accounts.models import User


class ProfileForm(forms.ModelForm):
    """ویرایش پروفایل — ایمیل ورود ثابت می‌ماند؛ نام کاربری قابل تغییر است."""

    clear_avatar = forms.BooleanField(
        required=False,
        label='حذف عکس فعلی',
    )

    class Meta:
        model = User
        fields = (
            'username',
            'first_name',
            'last_name',
            'telegram_id',
            'avatar',
        )
        widgets = {
            'username': forms.TextInput(
                attrs={
                    'placeholder': 'نامی که با آن صدا زده می‌شوی',
                    'autocomplete': 'nickname',
                }
            ),
            'first_name': forms.TextInput(
                attrs={'placeholder': 'نام', 'autocomplete': 'given-name'}
            ),
            'last_name': forms.TextInput(
                attrs={'placeholder': 'نام خانوادگی', 'autocomplete': 'family-name'}
            ),
            'telegram_id': forms.TextInput(
                attrs={
                    'placeholder': '@username یا شناسه عددی',
                    'autocomplete': 'off',
                }
            ),
            'avatar': forms.FileInput(attrs={'accept': 'image/*'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].label = 'نام کاربری'
        self.fields['username'].help_text = 'می‌تواند با دیگران یکسان باشد.'
        for name, field in self.fields.items():
            if name == 'clear_avatar':
                continue
            css = 'field-input'
            if isinstance(field.widget, forms.FileInput):
                css = 'field-file'
            field.widget.attrs.setdefault('class', css)
            if name != 'username':
                field.required = False

        if not self.instance or not self.instance.avatar:
            self.fields['clear_avatar'].widget = forms.HiddenInput()

    def clean_username(self):
        username = (self.cleaned_data.get('username') or '').strip()
        if not username:
            raise forms.ValidationError('نام کاربری را وارد کن.')
        return username

    def save(self, commit=True):
        user = super().save(commit=False)
        new_avatar = self.cleaned_data.get('avatar')
        if self.cleaned_data.get('clear_avatar') and not new_avatar and user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
        if commit:
            user.save()
        return user
