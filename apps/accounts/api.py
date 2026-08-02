from django.contrib.auth import logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.services.auth import authenticate_user, login_user, register_user


class UserSerializer(serializers.ModelSerializer):
    display_label = serializers.CharField(source='get_display_label', read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'telegram_id',
            'display_name',
            'display_label',
            'avatar_url',
            'date_joined',
        )
        read_only_fields = fields

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        email = User.objects.normalize_email(value).strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('این ایمیل قبلاً ثبت شده است.')
        return email

    def validate_username(self, value):
        username = (value or '').strip()
        if not username:
            raise serializers.ValidationError('نام کاربری را وارد کن.')
        return username

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'تکرار رمز عبور مطابقت ندارد.'})
        try:
            validate_password(attrs['password'])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)}) from exc
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    telegram_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    clear_avatar = serializers.BooleanField(required=False, default=False)

    def validate_username(self, value):
        username = (value or '').strip()
        if not username:
            raise serializers.ValidationError('نام کاربری را وارد کن.')
        return username

    def update(self, instance, validated_data):
        instance.username = validated_data['username']
        instance.first_name = validated_data.get('first_name', '') or ''
        instance.last_name = validated_data.get('last_name', '') or ''
        instance.telegram_id = validated_data.get('telegram_id', '') or ''
        new_avatar = validated_data.get('avatar')
        if validated_data.get('clear_avatar') and not new_avatar and instance.avatar:
            instance.avatar.delete(save=False)
            instance.avatar = None
        elif new_avatar:
            instance.avatar = new_avatar
        instance.save()
        return instance


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class MeView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False, 'user': None})
        return Response(
            {
                'authenticated': True,
                'user': UserSerializer(request.user, context={'request': request}).data,
            }
        )

    def patch(self, request):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data.setdefault('username', request.user.username)
        serializer = ProfileUpdateSerializer(data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.update(request.user, serializer.validated_data)
        return Response(UserSerializer(user, context={'request': request}).data)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate_user(
            request,
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        if user is None:
            return Response(
                {'detail': 'ایمیل یا رمز عبور نادرست است.', 'errors': {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_active:
            return Response(
                {'detail': 'این حساب غیرفعال است.', 'errors': {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login_user(request, user)
        return Response(
            {
                'authenticated': True,
                'user': UserSerializer(user, context={'request': request}).data,
            }
        )


class SignupView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = register_user(
            email=data['email'],
            password=data['password'],
            username=data['username'],
        )
        login_user(request, user)
        return Response(
            {
                'authenticated': True,
                'user': UserSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
