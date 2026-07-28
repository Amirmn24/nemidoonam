from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from apps.challenges.forms import ChallengeForm
from apps.challenges.models import Challenge, ChallengeStatus
from apps.challenges.services import (
    compute_progress,
    create_challenge,
    get_challenge_queryset,
    get_challenges_by_status,
    refresh_challenges_for_user,
    refresh_status,
    update_challenge,
)


class ChallengeListView(LoginRequiredMixin, View):
    template_name = 'challenges/challenge_list.html'

    def get(self, request):
        refresh_challenges_for_user(request.user)
        status = request.GET.get('status')
        challenges = get_challenges_by_status(request.user, status)
        items = [
            {
                'challenge': challenge,
                'progress': compute_progress(challenge),
            }
            for challenge in challenges
        ]
        owned = Challenge.objects.filter(owner=request.user)
        context = {
            'items': items,
            'statuses': ChallengeStatus.choices,
            'active_status': status or '',
            'total_count': owned.count(),
            'active_count': owned.filter(status=ChallengeStatus.ACTIVE).count(),
            'completed_count': owned.filter(status=ChallengeStatus.COMPLETED).count(),
        }
        return render(request, self.template_name, context)


class ChallengeCreateView(LoginRequiredMixin, View):
    template_name = 'challenges/challenge_form.html'

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': ChallengeForm(user=request.user),
                'page_title': 'چالش جدید',
            },
        )

    def post(self, request):
        form = ChallengeForm(request.user, request.POST)
        if form.is_valid():
            challenge = create_challenge(
                request.user,
                title=form.cleaned_data['title'],
                description=form.cleaned_data.get('description', ''),
                period_unit=form.cleaned_data['period_unit'],
                duration=form.cleaned_data['duration'],
                starts_on=form.cleaned_data['starts_on'],
                books=list(form.cleaned_data['books']),
            )
            messages.success(request, f'چالش «{challenge.title}» ساخته شد.')
            return redirect('challenges:detail', pk=challenge.pk)
        return render(
            request,
            self.template_name,
            {'form': form, 'page_title': 'چالش جدید'},
        )


class ChallengeDetailView(LoginRequiredMixin, View):
    template_name = 'challenges/challenge_detail.html'

    def get(self, request, pk):
        challenge = get_object_or_404(
            get_challenge_queryset(request.user),
            pk=pk,
        )
        refresh_status(challenge)
        progress = compute_progress(challenge)
        challenge_books = challenge.challenge_books.select_related('book')
        context = {
            'challenge': challenge,
            'progress': progress,
            'challenge_books': challenge_books,
        }
        return render(request, self.template_name, context)


class ChallengeUpdateView(LoginRequiredMixin, View):
    template_name = 'challenges/challenge_form.html'

    def get(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk, owner=request.user)
        return render(
            request,
            self.template_name,
            {
                'form': ChallengeForm(user=request.user, instance=challenge),
                'challenge': challenge,
                'page_title': f'ویرایش «{challenge.title}»',
            },
        )

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk, owner=request.user)
        form = ChallengeForm(request.user, request.POST, instance=challenge)
        if form.is_valid():
            challenge = update_challenge(
                challenge,
                title=form.cleaned_data['title'],
                description=form.cleaned_data.get('description', ''),
                period_unit=form.cleaned_data['period_unit'],
                duration=form.cleaned_data['duration'],
                starts_on=form.cleaned_data['starts_on'],
                books=list(form.cleaned_data['books']),
            )
            messages.success(request, 'چالش به‌روزرسانی شد.')
            return redirect('challenges:detail', pk=challenge.pk)
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'challenge': challenge,
                'page_title': f'ویرایش «{challenge.title}»',
            },
        )


class ChallengeDeleteView(LoginRequiredMixin, View):
    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk, owner=request.user)
        title = challenge.title
        challenge.delete()
        messages.success(request, f'چالش «{title}» حذف شد.')
        return redirect('challenges:list')
