from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models


class UserManager(DjangoUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('ایمیل الزامی است.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('سوپریوزر باید is_staff=True باشد.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('سوپریوزر باید is_superuser=True باشد.')
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    کاربر سامانه.

    ورود با ایمیل و رمز. نام‌کاربری فقط برای صدا زدن است و می‌تواند تکراری باشد.
    """

    # نام‌کاربری غیریکتا — فقط نمایشی
    username = models.CharField(
        'نام کاربری',
        max_length=150,
        help_text='نامی که با آن صدا زده می‌شوی؛ می‌تواند تکراری باشد.',
    )
    email = models.EmailField('ایمیل', unique=True)
    telegram_id = models.CharField(
        'آیدی تلگرام',
        max_length=64,
        blank=True,
        help_text='مثلاً @username یا شناسه عددی — اختیاری',
    )
    display_name = models.CharField(
        'نام نمایشی',
        max_length=120,
        blank=True,
        help_text='اگر خالی باشد، نام کاربری نمایش داده می‌شود.',
    )
    avatar = models.ImageField(
        'عکس پروفایل',
        upload_to='accounts/avatars/',
        blank=True,
        null=True,
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'
        ordering = ['email']

    def __str__(self) -> str:
        return self.get_display_label()

    def get_display_label(self) -> str:
        return (self.display_name or self.username or self.email).strip()
