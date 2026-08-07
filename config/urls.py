from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from config.spa import SpaView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('config.api_urls')),
]

frontend_dist = Path(settings.FRONTEND_DIST)
if frontend_dist.exists():
    urlpatterns += [
        re_path(
            r'^assets/(?P<path>.*)$',
            serve,
            {'document_root': frontend_dist / 'assets'},
        ),
        re_path(
            r'^img/(?P<path>.*)$',
            serve,
            {'document_root': frontend_dist / 'img'},
        ),
        # Root SPA assets from Vite public/ (favicon, etc.)
        path(
            'favicon.ico',
            serve,
            {'document_root': frontend_dist, 'path': 'favicon.ico'},
        ),
        path(
            'favicon.svg',
            serve,
            {'document_root': frontend_dist, 'path': 'favicon.svg'},
        ),
        path(
            'icons.svg',
            serve,
            {'document_root': frontend_dist, 'path': 'icons.svg'},
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA catch-all — must be last (keeps /api and /admin above)
urlpatterns += [
    re_path(
        r'^(?!api/|admin/|static/|media/|assets/|img/|favicon\.ico|favicon\.svg|icons\.svg).*$',
        SpaView.as_view(),
        name='spa',
    ),
]
