from django import forms
from django.contrib.auth.forms import AuthenticationForm


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
