from django import forms

from apps.accounts.models import User


class ProfileForm(forms.ModelForm):
    """ویرایش اطلاعات پروفایل کاربر."""

    clear_avatar = forms.BooleanField(
        required=False,
        label='حذف عکس فعلی',
    )

    class Meta:
        model = User
        fields = (
            'display_name',
            'first_name',
            'last_name',
            'email',
            'telegram_id',
            'avatar',
        )
        widgets = {
            'display_name': forms.TextInput(
                attrs={'placeholder': 'نامی که در هدر دیده می‌شود'}
            ),
            'first_name': forms.TextInput(attrs={'placeholder': 'نام'}),
            'last_name': forms.TextInput(attrs={'placeholder': 'نام خانوادگی'}),
            'email': forms.EmailInput(attrs={'placeholder': 'email@example.com'}),
            'telegram_id': forms.TextInput(
                attrs={'placeholder': '@username یا شناسه عددی'}
            ),
            'avatar': forms.FileInput(attrs={'accept': 'image/*'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            if name == 'clear_avatar':
                continue
            css = 'field-input'
            if isinstance(field.widget, forms.FileInput):
                css = 'field-file'
            field.widget.attrs.setdefault('class', css)
            field.required = False

        if not self.instance or not self.instance.avatar:
            self.fields['clear_avatar'].widget = forms.HiddenInput()

    def save(self, commit=True):
        user = super().save(commit=False)
        new_avatar = self.cleaned_data.get('avatar')
        if self.cleaned_data.get('clear_avatar') and not new_avatar and user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
        if commit:
            user.save()
        return user
