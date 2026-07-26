from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        'username',
        'display_name',
        'email',
        'telegram_id',
        'is_staff',
        'is_active',
        'date_joined',
    )
    list_filter = ('is_staff', 'is_active', 'is_superuser')
    search_fields = ('username', 'display_name', 'email', 'telegram_id', 'first_name', 'last_name')
    ordering = ('username',)

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (
            'پروفایل',
            {
                'fields': (
                    'display_name',
                    'first_name',
                    'last_name',
                    'email',
                    'telegram_id',
                ),
                'description': 'ایمیل و تلگرام اختیاری‌اند و بعداً قابل تکمیل‌اند.',
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
                'fields': ('username', 'password1', 'password2', 'is_staff', 'is_active'),
            },
        ),
    )
