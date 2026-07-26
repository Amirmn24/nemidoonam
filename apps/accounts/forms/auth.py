from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from apps.accounts.models import User


class LoginForm(AuthenticationForm):
    """فرم ورود — فقط نام‌کاربری و رمز."""

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
                'class': 'auth-input',
                'placeholder': 'نام‌کاربری',
                'autocomplete': 'username',
                'id': 'id_login_username',
            }
        ),
    )
    password = forms.CharField(
        label='رمز عبور',
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                'class': 'auth-input',
                'placeholder': 'رمز عبور',
                'autocomplete': 'current-password',
                'id': 'id_login_password',
            }
        ),
    )


class SignupForm(UserCreationForm):
    """ثبت‌نام با نام‌کاربری و رمز؛ ایمیل و تلگرام بعداً."""

    class Meta:
        model = User
        fields = ('username',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].label = 'نام‌کاربری'
        self.fields['username'].help_text = ''
        self.fields['username'].widget.attrs.update(
            {
                'class': 'auth-input',
                'placeholder': 'نام‌کاربری',
                'autocomplete': 'username',
                'id': 'id_signup_username',
            }
        )
        self.fields['password1'].label = 'رمز عبور'
        self.fields['password1'].help_text = ''
        self.fields['password1'].widget.attrs.update(
            {
                'class': 'auth-input',
                'placeholder': 'رمز عبور',
                'autocomplete': 'new-password',
                'id': 'id_signup_password1',
            }
        )
        self.fields['password2'].label = 'تکرار رمز'
        self.fields['password2'].help_text = ''
        self.fields['password2'].widget.attrs.update(
            {
                'class': 'auth-input',
                'placeholder': 'تکرار رمز عبور',
                'autocomplete': 'new-password',
                'id': 'id_signup_password2',
            }
        )

    def clean_username(self):
        username = self.cleaned_data['username'].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError('این نام‌کاربری قبلاً گرفته شده است.')
        return username
