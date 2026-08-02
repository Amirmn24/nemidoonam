from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views import View


class SpaView(View):
    """سرو کردن index.html بیلد React برای مسیرهای غیر-API."""

    def get(self, request, *args, **kwargs):
        index = Path(settings.FRONTEND_DIST) / 'index.html'
        if not index.exists():
            raise Http404(
                'فرانت‌اند بیلد نشده است. در پوشه frontend دستور npm run build را اجرا کن '
                'یا برای توسعه از Vite روی پورت 5173 استفاده کن.'
            )
        return FileResponse(index.open('rb'), content_type='text/html')
