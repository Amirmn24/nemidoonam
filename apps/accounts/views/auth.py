from django.contrib import messages
from django.contrib.auth import login, logout
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View

from apps.accounts.forms import LoginForm


class LoginView(View):
    template_name = 'accounts/login.html'
    form_class = LoginForm

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(self.get_success_url())
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
            login(request, form.get_user())
            messages.success(
                request,
                f'خوش آمدی، {request.user.get_display_label()}.',
            )
            return redirect(self.get_success_url(next_url))
        return render(
            request,
            self.template_name,
            {'form': form, 'next': next_url},
        )

    def get_success_url(self, next_url: str = '') -> str:
        if next_url and next_url.startswith('/') and not next_url.startswith('//'):
            return next_url
        return reverse('books:list')


class LogoutView(View):
    def post(self, request):
        if request.user.is_authenticated:
            logout(request)
            messages.success(request, 'با موفقیت خارج شدی.')
        return redirect('accounts:login')

    def get(self, request):
        # خروج فقط با POST از فرم ناوبری
        if request.user.is_authenticated:
            return redirect('books:list')
        return redirect('accounts:login')
