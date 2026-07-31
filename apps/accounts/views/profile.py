from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect, render
from django.views import View

from apps.accounts.forms import ProfileForm


class ProfileView(LoginRequiredMixin, View):
    template_name = 'accounts/profile.html'

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': ProfileForm(instance=request.user),
                'profile_user': request.user,
            },
        )

    def post(self, request):
        form = ProfileForm(
            request.POST,
            request.FILES,
            instance=request.user,
        )
        if form.is_valid():
            form.save()
            messages.success(request, 'پروفایل با موفقیت به‌روزرسانی شد.')
            return redirect('accounts:profile')
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'profile_user': request.user,
            },
        )
