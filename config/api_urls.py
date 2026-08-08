from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.api import (
    CsrfView,
    DashboardView,
    LoginView,
    LogoutView,
    MeView,
    SignupView,
    VibeRefreshView,
    WaitlistJoinView,
)
from apps.books.api import (
    CatalogAddView,
    EchoActionView,
    EchoView,
    EntryViewSet,
    MetaChoicesView,
    ShelfViewSet,
    SuggestView,
)
from apps.challenges.api import ChallengeViewSet
from apps.vocabulary.api import WordViewSet

router = DefaultRouter()
router.register('shelf', ShelfViewSet, basename='shelf')
router.register('challenges', ChallengeViewSet, basename='challenges')
router.register('vocabulary', WordViewSet, basename='vocabulary')

entry_list = EntryViewSet.as_view({'get': 'list', 'post': 'create'})
entry_detail = EntryViewSet.as_view(
    {'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}
)
entry_publish = EntryViewSet.as_view({'post': 'publish'})

urlpatterns = [
    path('auth/csrf/', CsrfView.as_view(), name='api-csrf'),
    path('auth/login/', LoginView.as_view(), name='api-login'),
    path('auth/signup/', SignupView.as_view(), name='api-signup'),
    path('auth/logout/', LogoutView.as_view(), name='api-logout'),
    path('auth/me/', MeView.as_view(), name='api-me'),
    path('waitlist/', WaitlistJoinView.as_view(), name='api-waitlist'),
    path('dashboard/', DashboardView.as_view(), name='api-dashboard'),
    path('dashboard/vibe/refresh/', VibeRefreshView.as_view(), name='api-vibe-refresh'),
    path('meta/choices/', MetaChoicesView.as_view(), name='api-meta-choices'),
    path('books/suggest/', SuggestView.as_view(), name='api-suggest'),
    path('books/echo/', EchoView.as_view(), name='api-echo'),
    path('books/echo/<uuid:token>/<str:action>/', EchoActionView.as_view(), name='api-echo-action'),
    path('catalog/<int:pk>/add/', CatalogAddView.as_view(), name='api-catalog-add'),
    path('shelf/<int:book_pk>/entries/', entry_list, name='api-entries'),
    path('shelf/<int:book_pk>/entries/<int:pk>/', entry_detail, name='api-entry-detail'),
    path(
        'shelf/<int:book_pk>/entries/<int:pk>/publish/',
        entry_publish,
        name='api-entry-publish',
    ),
    path('', include(router.urls)),
]
