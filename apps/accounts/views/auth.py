from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View

from apps.accounts.forms import LoginForm, SignupForm
from apps.accounts.services import login_user, register_user


def _safe_next_url(next_url: str = '') -> str:
    if next_url and next_url.startswith('/') and not next_url.startswith('//'):
        return next_url
    return reverse('books:list')


class LoginView(View):
    template_name = 'accounts/login.html'
    form_class = LoginForm

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(_safe_next_url())
        return super().dispatch(request, *args, **kwargs)

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': self.form_class(request),
                'next': request.GET.get('next', ''),
            },
        )

    def post(self, request):
        form = self.form_class(request, data=request.POST)
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
            self.template_name,
            {'form': form, 'next': next_url},
        )


class SignupView(View):
    template_name = 'accounts/signup.html'
    form_class = SignupForm

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(_safe_next_url())
        return super().dispatch(request, *args, **kwargs)

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': self.form_class(),
                'next': request.GET.get('next', ''),
            },
        )

    def post(self, request):
        form = self.form_class(request.POST)
        next_url = request.POST.get('next') or request.GET.get('next') or ''
        if form.is_valid():
            user = register_user(
                username=form.cleaned_data['username'],
                password=form.cleaned_data['password1'],
            )
            login_user(request, user)
            messages.success(
                request,
                f'حسابت ساخته شد. خوش آمدی، {user.get_display_label()}.',
            )
            return redirect(_safe_next_url(next_url))
        return render(
            request,
            self.template_name,
            {'form': form, 'next': next_url},
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
