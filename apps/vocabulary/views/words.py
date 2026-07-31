from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from apps.vocabulary.forms import WordForm
from apps.vocabulary.models import Word
from apps.vocabulary.services import (
    create_word,
    get_word_queryset,
    update_word,
)


class WordListView(LoginRequiredMixin, View):
    template_name = 'vocabulary/word_list.html'

    def get(self, request):
        base_qs = get_word_queryset(request.user)
        words = base_qs
        q = (request.GET.get('q') or '').strip()
        if q:
            words = words.filter(
                Q(term__icontains=q) | Q(meaning__icontains=q)
            )
        context = {
            'words': words,
            'total_count': base_qs.count(),
            'query': q,
            'with_audio_count': base_qs.exclude(audio='').exclude(audio=None).count(),
        }
        return render(request, self.template_name, context)


class WordCreateView(LoginRequiredMixin, View):
    template_name = 'vocabulary/word_form.html'

    def get(self, request):
        return render(
            request,
            self.template_name,
            {
                'form': WordForm(),
                'page_title': 'واژه جدید',
            },
        )

    def post(self, request):
        form = WordForm(request.POST, request.FILES)
        if form.is_valid():
            word = create_word(
                request.user,
                term=form.cleaned_data['term'],
                meaning=form.cleaned_data['meaning'],
                usage=form.cleaned_data.get('usage', ''),
                audio=form.cleaned_data.get('audio'),
            )
            messages.success(request, f'واژه «{word.term}» اضافه شد.')
            return redirect('vocabulary:list')
        return render(
            request,
            self.template_name,
            {'form': form, 'page_title': 'واژه جدید'},
        )


class WordUpdateView(LoginRequiredMixin, View):
    template_name = 'vocabulary/word_form.html'

    def get(self, request, pk):
        word = get_object_or_404(Word, pk=pk, owner=request.user)
        return render(
            request,
            self.template_name,
            {
                'form': WordForm(instance=word),
                'word': word,
                'page_title': f'ویرایش «{word.term}»',
            },
        )

    def post(self, request, pk):
        word = get_object_or_404(Word, pk=pk, owner=request.user)
        form = WordForm(request.POST, request.FILES, instance=word)
        if form.is_valid():
            update_word(
                word,
                term=form.cleaned_data['term'],
                meaning=form.cleaned_data['meaning'],
                usage=form.cleaned_data.get('usage', ''),
                audio=form.cleaned_data.get('audio'),
                clear_audio=request.POST.get('clear_audio') == '1',
            )
            messages.success(request, 'واژه به‌روزرسانی شد.')
            return redirect('vocabulary:list')
        return render(
            request,
            self.template_name,
            {
                'form': form,
                'word': word,
                'page_title': f'ویرایش «{word.term}»',
            },
        )


class WordDeleteView(LoginRequiredMixin, View):
    def post(self, request, pk):
        word = get_object_or_404(Word, pk=pk, owner=request.user)
        term = word.term
        if word.audio:
            word.audio.delete(save=False)
        word.delete()
        messages.success(request, f'واژه «{term}» حذف شد.')
        return redirect('vocabulary:list')
