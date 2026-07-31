from django.urls import path

from apps.books.views import (
    BookAddToShelfView,
    BookCreateView,
    BookDeleteView,
    BookDetailView,
    BookListView,
    BookProgressUpdateView,
    BookSuggestView,
    BookUpdateView,
    EntryCreateView,
    EntryDeleteView,
    EntryUpdateView,
)

app_name = 'books'

urlpatterns = [
    path('', BookListView.as_view(), name='list'),
    path('new/', BookCreateView.as_view(), name='create'),
    path('suggest/', BookSuggestView.as_view(), name='suggest'),
    path('catalog/<int:pk>/add/', BookAddToShelfView.as_view(), name='add_to_shelf'),
    path('<int:pk>/', BookDetailView.as_view(), name='detail'),
    path('<int:pk>/edit/', BookUpdateView.as_view(), name='update'),
    path('<int:pk>/delete/', BookDeleteView.as_view(), name='delete'),
    path('<int:pk>/progress/', BookProgressUpdateView.as_view(), name='progress'),
    path('<int:book_pk>/entries/new/', EntryCreateView.as_view(), name='entry_create'),
    path(
        '<int:book_pk>/entries/<int:pk>/edit/',
        EntryUpdateView.as_view(),
        name='entry_update',
    ),
    path(
        '<int:book_pk>/entries/<int:pk>/delete/',
        EntryDeleteView.as_view(),
        name='entry_delete',
    ),
]
