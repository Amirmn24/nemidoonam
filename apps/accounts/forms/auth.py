from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from apps.accounts.models import User


class LoginForm(AuthenticationForm):
    """فرم ورود — فقط نام‌کاربری و رمز؛ قابل گسترش برای ۲FA و غیره."""

    error_messages = {
        **AuthenticationForm.error_messages,
        'invalid_login': 'نام‌کاربری یا رمز عبور نادرست است.',
        'inactive': 'این حساب غیرفعال است.',
    }

    username = forms.CharField(
        label='نام‌کاربری',
        max_length=150,
        widget=forms.TextInput(
            attrs={
                'class': 'field-input',
                'placeholder': 'نام‌کاربری',
                'autocomplete': 'username',
                'autofocus': True,
            }
        ),
    )
    password = forms.CharField(
        label='رمز عبور',
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                'class': 'field-input',
                'placeholder': 'رمز عبور',
                'autocomplete': 'current-password',
            }
        ),
    )


class SignupForm(UserCreationForm):
    """ثبت‌نام با نام‌کاربری و رمز؛ ایمیل و تلگرام بعداً در پروفایل."""

    class Meta:
        model = User
        fields = ('username',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].label = 'نام‌کاربری'
        self.fields['username'].widget.attrs.update(
            {
                'class': 'field-input',
                'placeholder': 'نام‌کاربری',
                'autocomplete': 'username',
                'autofocus': True,
            }
        )
        self.fields['password1'].label = 'رمز عبور'
        self.fields['password1'].widget.attrs.update(
            {
                'class': 'field-input',
                'placeholder': 'رمز عبور',
                'autocomplete': 'new-password',
            }
        )
        self.fields['password2'].label = 'تکرار رمز عبور'
        self.fields['password2'].widget.attrs.update(
            {
                'class': 'field-input',
                'placeholder': 'تکرار رمز عبور',
                'autocomplete': 'new-password',
            }
        )
        self.fields['password1'].help_text = (
            'حداقل ۸ کاراکتر؛ از رمزهای خیلی ساده یا رایج استفاده نکن.'
        )
        self.fields['password2'].help_text = ''
        self.fields['username'].help_text = (
            'فقط حروف، عدد و @ . + - _'
        )

    def clean_username(self):
        username = self.cleaned_data['username'].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError('این نام‌کاربری قبلاً گرفته شده است.')
        return username
