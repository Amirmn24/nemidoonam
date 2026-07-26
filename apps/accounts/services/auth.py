from django.contrib.auth import authenticate, login
from django.contrib.auth.base_user import AbstractBaseUser
from django.http import HttpRequest

from apps.accounts.models import User


def authenticate_user(
    request: HttpRequest,
    *,
    username: str,
    password: str,
) -> AbstractBaseUser | None:
    """احراز هویت متمرکز — نقطهٔ گسترش برای لاگ، محدودیت نرخ و غیره."""
    return authenticate(
        request,
        username=username.strip(),
        password=password,
    )


def register_user(
    *,
    username: str,
    password: str,
) -> User:
    """ساخت کاربر جدید — نقطهٔ گسترش برای پروفایل پیش‌فرض و رویدادها."""
    return User.objects.create_user(
        username=username.strip(),
        password=password,
    )


def login_user(request: HttpRequest, user: AbstractBaseUser) -> None:
    """ورود نشست کاربر پس از لاگین یا ثبت‌نام."""
    login(request, user)
