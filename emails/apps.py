from django.apps import AppConfig


class EmailsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'emails'
    verbose_name = 'ایمیل‌ها'

    def ready(self) -> None:
        from . import signals  # noqa: F401
