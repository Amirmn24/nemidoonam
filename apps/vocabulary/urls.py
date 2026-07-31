from django.urls import path

from apps.vocabulary.views import (
    WordCreateView,
    WordDeleteView,
    WordListView,
    WordUpdateView,
)

app_name = 'vocabulary'

urlpatterns = [
    path('', WordListView.as_view(), name='list'),
    path('new/', WordCreateView.as_view(), name='create'),
    path('<int:pk>/edit/', WordUpdateView.as_view(), name='update'),
    path('<int:pk>/delete/', WordDeleteView.as_view(), name='delete'),
]
