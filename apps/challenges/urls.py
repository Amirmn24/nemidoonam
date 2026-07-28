from django.urls import path

from apps.challenges.views import (
    ChallengeCreateView,
    ChallengeDeleteView,
    ChallengeDetailView,
    ChallengeListView,
    ChallengeUpdateView,
)

app_name = 'challenges'

urlpatterns = [
    path('', ChallengeListView.as_view(), name='list'),
    path('new/', ChallengeCreateView.as_view(), name='create'),
    path('<int:pk>/', ChallengeDetailView.as_view(), name='detail'),
    path('<int:pk>/edit/', ChallengeUpdateView.as_view(), name='update'),
    path('<int:pk>/delete/', ChallengeDeleteView.as_view(), name='delete'),
]
