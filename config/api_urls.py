from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.api import (
    CsrfView,
    DashboardView,
    LoginView,
    LogoutView,
    MeView,
    SignupView,
)
from apps.books.api import CatalogAddView, EntryViewSet, MetaChoicesView, ShelfViewSet, SuggestView
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

urlpatterns = [
    path('auth/csrf/', CsrfView.as_view(), name='api-csrf'),
    path('auth/login/', LoginView.as_view(), name='api-login'),
    path('auth/signup/', SignupView.as_view(), name='api-signup'),
    path('auth/logout/', LogoutView.as_view(), name='api-logout'),
    path('auth/me/', MeView.as_view(), name='api-me'),
    path('dashboard/', DashboardView.as_view(), name='api-dashboard'),
    path('meta/choices/', MetaChoicesView.as_view(), name='api-meta-choices'),
    path('books/suggest/', SuggestView.as_view(), name='api-suggest'),
    path('catalog/<int:pk>/add/', CatalogAddView.as_view(), name='api-catalog-add'),
    path('shelf/<int:book_pk>/entries/', entry_list, name='api-entries'),
    path('shelf/<int:book_pk>/entries/<int:pk>/', entry_detail, name='api-entry-detail'),
    path('', include(router.urls)),
]
