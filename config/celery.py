import os
import sys

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# روی ویندوز pool پیش‌فرض (prefork) خراب است
if sys.platform == 'win32':
    os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')

app = Celery('nemidoonam')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

if sys.platform == 'win32':
    app.conf.worker_pool = 'solo'
