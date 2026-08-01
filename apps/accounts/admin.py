from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        'email',
        'username',
        'telegram_id',
        'is_staff',
        'is_active',
        'date_joined',
    )
    list_filter = ('is_staff', 'is_active', 'is_superuser')
    search_fields = ('email', 'username', 'telegram_id', 'first_name', 'last_name')
    ordering = ('email',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (
            'پروفایل',
            {
                'fields': (
                    'username',
                    'display_name',
                    'avatar',
                    'first_name',
                    'last_name',
                    'telegram_id',
                ),
                'description': 'ایمیل برای ورود یکتاست؛ نام کاربری فقط نمایشی است.',
            },
        ),
        (
            'دسترسی',
            {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')},
        ),
        ('تاریخ‌ها', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'username', 'password1', 'password2', 'is_staff', 'is_active'),
            },
        ),
    )
