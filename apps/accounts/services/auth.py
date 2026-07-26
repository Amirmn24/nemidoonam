from django.contrib.auth import authenticate
from django.contrib.auth.base_user import AbstractBaseUser
from django.http import HttpRequest


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
