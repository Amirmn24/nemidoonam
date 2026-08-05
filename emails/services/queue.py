from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


def enqueue(task: Any, *args, **kwargs):
    """
    صف کردن تسک Celery؛ اگر broker در دسترس نباشد یا حالت eager باشد، هم‌زمان اجرا می‌شود.
    """
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        return task.apply(args=args, kwargs=kwargs)

    try:
        return task.delay(*args, **kwargs)
    except Exception as exc:
        # Redis/Celery خاموش بودن در لوکال طبیعی است؛ traceback کامل لازم نیست
        logger.warning(
            'صف Celery در دسترس نبود (%s)؛ تسک %s هم‌زمان اجرا می‌شود.',
            exc.__class__.__name__,
            getattr(task, 'name', task),
        )
        return task.apply(args=args, kwargs=kwargs)
