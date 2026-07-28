from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View

from apps.accounts.forms import LoginForm, SignupForm
from apps.accounts.services import login_user, register_user

AUTH_TEMPLATE = 'accounts/auth.html'
LOGIN_AUTO_ID = 'id_login_%s'
SIGNUP_AUTO_ID = 'id_signup_%s'


def _safe_next_url(next_url: str = '') -> str:
    if next_url and next_url.startswith('/') and not next_url.startswith('//'):
        return next_url
    return reverse('books:list')


def _auth_context(
    request,
    *,
    mode: str,
    login_form: LoginForm | None = None,
    signup_form: SignupForm | None = None,
    next_url: str = '',
) -> dict:
    return {
        'mode': mode,
        'login_form': login_form or LoginForm(request, auto_id=LOGIN_AUTO_ID),
        'signup_form': signup_form or SignupForm(auto_id=SIGNUP_AUTO_ID),
        'next': next_url,
    }


class LoginView(View):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(_safe_next_url())
        return super().dispatch(request, *args, **kwargs)

    def get(self, request):
        return render(
            request,
            AUTH_TEMPLATE,
            _auth_context(
                request,
                mode='login',
                next_url=request.GET.get('next', ''),
            ),
        )

    def post(self, request):
        form = LoginForm(request, data=request.POST, auto_id=LOGIN_AUTO_ID)
        next_url = request.POST.get('next') or request.GET.get('next') or ''
        if form.is_valid():
            login_user(request, form.get_user())
            messages.success(
                request,
                f'خوش آمدی، {request.user.get_display_label()}.',
            )
            return redirect(_safe_next_url(next_url))
        return render(
            request,
            AUTH_TEMPLATE,
            _auth_context(
                request,
                mode='login',
                login_form=form,
                next_url=next_url,
            ),
        )


class SignupView(View):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(_safe_next_url())
        return super().dispatch(request, *args, **kwargs)

    def get(self, request):
        return render(
            request,
            AUTH_TEMPLATE,
            _auth_context(
                request,
                mode='signup',
                next_url=request.GET.get('next', ''),
            ),
        )

    def post(self, request):
        form = SignupForm(request.POST, auto_id=SIGNUP_AUTO_ID)
        next_url = request.POST.get('next') or request.GET.get('next') or ''
        if form.is_valid():
            user = register_user(
                username=form.cleaned_data['username'],
                password=form.cleaned_data['password1'],
                email=form.cleaned_data.get('email', ''),
                display_name=form.cleaned_data.get('display_name', ''),
            )
            login_user(request, user)
            messages.success(
                request,
                f'حسابت ساخته شد. خوش آمدی، {user.get_display_label()}.',
            )
            return redirect(_safe_next_url(next_url))
        return render(
            request,
            AUTH_TEMPLATE,
            _auth_context(
                request,
                mode='signup',
                signup_form=form,
                next_url=next_url,
            ),
        )


class LogoutView(View):
    def post(self, request):
        from django.contrib.auth import logout

        if request.user.is_authenticated:
            logout(request)
            messages.success(request, 'با موفقیت خارج شدی.')
        return redirect('accounts:login')

    def get(self, request):
        if request.user.is_authenticated:
            return redirect('books:list')
        return redirect('accounts:login')
