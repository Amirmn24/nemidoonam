from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'django-insecure-dev-only-change-me-before-production',
)
DEBUG = os.getenv('DJANGO_DEBUG', 'true').lower() in {'1', 'true', 'yes'}
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
    if host.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.accounts',
    'apps.books.apps.BooksConfig',
    'apps.challenges',
    'apps.vocabulary',
    'emails.apps.EmailsConfig',
]

AUTH_USER_MODEL = 'accounts.User'

LOGIN_URL = '/login'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/login'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
FRONTEND_DIST = BASE_DIR / 'frontend' / 'dist'
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024

# --- API / SPA ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '2000/day',
        'finish_book': '30/hour',
        'peer_viewpoint': '40/hour',
        'entry_write': '120/hour',
        'echo': '30/hour',
        'waitlist': '10/hour',
    },
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'config.api_exceptions.custom_exception_handler',
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'DJANGO_CORS_ORIGINS',
        'http://127.0.0.1:5173,http://localhost:5173',
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'DJANGO_CSRF_TRUSTED_ORIGINS',
        'http://127.0.0.1:5173,http://localhost:5173,'
        'http://127.0.0.1:8000,http://localhost:8000',
    ).split(',')
    if origin.strip()
]

# Frontend reads csrftoken from cookie for SessionAuthentication
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# --- Email (SMTP) ---
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'amirryansedaghatpour@gmail.com')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() in {'1', 'true', 'yes'}
EMAIL_REPLY_TO = os.getenv('EMAIL_REPLY_TO', EMAIL_HOST_USER)
# نام نمایشی فرستنده کمک می‌کند کمتر شبیه اسپم به نظر برسد
DEFAULT_FROM_EMAIL = os.getenv(
    'DEFAULT_FROM_EMAIL',
    f'نمی‌دونم <{EMAIL_HOST_USER}>',
)
SERVER_EMAIL = DEFAULT_FROM_EMAIL

if EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    # بدون رمز اپ Gmail، ایمیل در کنسول چاپ می‌شود
    EMAIL_BACKEND = os.getenv(
        'EMAIL_BACKEND',
        'django.core.mail.backends.console.EmailBackend',
    )

# --- Celery ---
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
# نتیجهٔ تسک لازم نیست؛ با غیرفعال کردنش ارور ذخیرهٔ Redis کمتر می‌شود
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', '') or None
CELERY_TASK_IGNORE_RESULT = True
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_TASK_ALWAYS_EAGER', 'false').lower() in {
    '1',
    'true',
    'yes',
}
CELERY_TASK_EAGER_PROPAGATES = True
# روی ویندوز حتماً solo؛ وگرنه ValueError در billiard می‌آید
if os.name == 'nt':
    CELERY_WORKER_POOL = 'solo'
CELERY_BEAT_SCHEDULE = {
    'check-challenge-email-reminders': {
        'task': 'emails.tasks.check_all_challenge_reminders',
        'schedule': timedelta(hours=1),
    },
}

# --- OpenAI (Reading Vibe) ---
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_VIBE_MODEL = os.getenv('OPENAI_VIBE_MODEL', 'gpt-4o-mini')

# --- Google Books (optional API key for higher quota) ---
GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY', '')
