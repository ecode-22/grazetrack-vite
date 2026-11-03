import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .models import FarmData
from .serializers import (
    FarmDataSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegistrationSerializer,
)
User = get_user_model()
logger = logging.getLogger('farmdata.security')


@method_decorator(csrf_protect, name='dispatch')
class CsrfProtectedAPIView(APIView):
    pass


def set_auth_cookies(response, access_token, refresh_token=None):
    cookie_options = {
        'httponly': True,
        'secure': settings.JWT_COOKIE_SECURE,
        'samesite': settings.JWT_COOKIE_SAMESITE,
        'path': settings.JWT_COOKIE_PATH,
    }
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE,
        access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **cookie_options,
    )
    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE,
            refresh_token,
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            **cookie_options,
        )


def clear_auth_cookies(response):
    for cookie_name in (settings.JWT_ACCESS_COOKIE, settings.JWT_REFRESH_COOKIE):
        response.delete_cookie(
            cookie_name,
            path=settings.JWT_COOKIE_PATH,
            samesite=settings.JWT_COOKIE_SAMESITE,
        )


def token_response(user, http_status=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    response = Response({'user': {'id': user.id, 'email': user.email}}, status=http_status)
    set_auth_cookies(response, str(refresh.access_token), str(refresh))
    return response


class CsrfTokenView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'csrfToken': get_token(request._request)})


class RegisterView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_register'

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response({'email': ['An account with this email already exists.']}, status=status.HTTP_400_BAD_REQUEST)
        send_mail(
            'Welcome to GrazingTrack',
            'Welcome to GrazingTrack. Your farm account is ready, and your farm records will sync whenever you are connected.',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
        return token_response(user, status.HTTP_201_CREATED)


class PasswordResetRequestView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data['email']).first()
        if user:
            query = urlencode({
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': default_token_generator.make_token(user),
            })
            reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?{query}"
            send_mail(
                'Reset your GrazingTrack password',
                f'Use this link to reset your GrazingTrack password:\n\n{reset_url}\n\nIf you did not request this, you can ignore this email.',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=True,
            )
        return Response({'detail': 'If an account exists for that email, a password reset link has been sent.'})


class PasswordResetConfirmView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_reset'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password'])
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        response = Response({'detail': 'Your password has been reset. Sign in with your new password.'})
        clear_auth_cookies(response)
        return response


class LoginView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError:
            logger.warning('Authentication failed remote_addr=%s', request.META.get('REMOTE_ADDR', 'unknown'))
            raise
        return token_response(serializer.validated_data['user'])


class CurrentUserView(CsrfProtectedAPIView):
    def get(self, request):
        return Response({
            'id': request.user.id,
            'email': request.user.email,
            'date_joined': request.user.date_joined,
        })


class PasswordChangeView(CsrfProtectedAPIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])

        current_refresh = serializer.validated_data['refresh']
        for token in OutstandingToken.objects.filter(user=request.user).exclude(token=current_refresh):
            BlacklistedToken.objects.get_or_create(token=token)
        return Response({'detail': 'Password updated.'})


class LogoutView(CsrfProtectedAPIView):
    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data['refresh']).blacklist()
        except TokenError:
            return Response({'detail': 'Refresh token is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        response = Response({'detail': 'Signed out.'})
        clear_auth_cookies(response)
        return response


class TokenCookieRefreshView(CsrfProtectedAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_refresh'

    def post(self, request):
        refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        serializer = TokenRefreshSerializer(data={'refresh': refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as cause:
            raise AuthenticationFailed('Refresh token is invalid or expired.') from cause
        response = Response({'detail': 'Session refreshed.'})
        set_auth_cookies(
            response,
            serializer.validated_data['access'],
            serializer.validated_data.get('refresh'),
        )
        return response


class FarmDataView(CsrfProtectedAPIView):
    throttle_scope = 'farm_data'

    def get(self, request):
        data = FarmData.objects.filter(user=request.user).first()
        if data is None:
            return Response({
                'fields': [],
                'events': [],
                'groups': [],
                'farm': None,
                'updated_at': None,
            })
        return Response(FarmDataSerializer(data).data)

    def put(self, request):
        expected_updated_at = request.data.get('expected_updated_at')
        with transaction.atomic():
            data, created = FarmData.objects.get_or_create(user=request.user)
            data = FarmData.objects.select_for_update().get(pk=data.pk)
            current_updated_at = None if created else FarmDataSerializer(data).data['updated_at']
            if expected_updated_at != current_updated_at:
                return Response(FarmDataSerializer(data).data, status=status.HTTP_409_CONFLICT)
            serializer = FarmDataSerializer(data, data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(FarmDataSerializer(data).data)