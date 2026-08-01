from django.contrib.auth import authenticate, login
from django.contrib.auth.base_user import AbstractBaseUser
from django.http import HttpRequest

from apps.accounts.models import User


def authenticate_user(
    request: HttpRequest,
    *,
    email: str,
    password: str,
) -> AbstractBaseUser | None:
    """احراز هویت با ایمیل — ModelBackend از USERNAME_FIELD استفاده می‌کند."""
    return authenticate(
        request,
        username=email.strip(),
        password=password,
    )


def register_user(
    *,
    email: str,
    password: str,
    username: str,
) -> User:
    """ساخت کاربر جدید با ایمیل یکتا و نام کاربری نمایشی."""
    return User.objects.create_user(
        email=email.strip(),
        password=password,
        username=username.strip(),
    )


def login_user(request: HttpRequest, user: AbstractBaseUser) -> None:
    """ورود نشست کاربر پس از لاگین یا ثبت‌نام."""
    login(request, user)
