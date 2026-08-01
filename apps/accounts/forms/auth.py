from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from apps.accounts.models import User


class LoginForm(AuthenticationForm):
    """ورود با ایمیل و رمز."""

    error_messages = {
        **AuthenticationForm.error_messages,
        'invalid_login': 'ایمیل یا رمز عبور نادرست است.',
        'inactive': 'این حساب غیرفعال است.',
    }

    username = forms.EmailField(
        label='ایمیل',
        widget=forms.EmailInput(
            attrs={
                'class': 'auth-input',
                'placeholder': 'ایمیل',
                'autocomplete': 'email',
                'id': 'id_login_email',
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
    """ثبت‌نام با ایمیل (یکتا) و نام کاربری (قابل‌تکرار)."""

    class Meta:
        model = User
        fields = ('email', 'username')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'].label = 'ایمیل'
        self.fields['email'].required = True
        self.fields['email'].widget.attrs.update(
            {
                'class': 'auth-input',
                'placeholder': 'ایمیل',
                'autocomplete': 'email',
                'id': 'id_signup_email',
            }
        )
        self.fields['username'].label = 'نام کاربری'
        self.fields['username'].help_text = ''
        self.fields['username'].widget.attrs.update(
            {
                'class': 'auth-input',
                'placeholder': 'نام کاربری (می‌تواند تکراری باشد)',
                'autocomplete': 'nickname',
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

    def clean_email(self):
        email = User.objects.normalize_email(self.cleaned_data['email']).strip()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('این ایمیل قبلاً ثبت شده است.')
        return email

    def clean_username(self):
        username = (self.cleaned_data.get('username') or '').strip()
        if not username:
            raise forms.ValidationError('نام کاربری را وارد کن.')
        return username
