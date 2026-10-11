from django.db import IntegrityError, transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import FarmData
from .serializers import (
    FarmDataSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    RegistrationSerializer,
)


def token_response(user, http_status=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {'id': user.id, 'email': user.email},
    }, status=http_status)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response({'email': ['An account with this email already exists.']}, status=status.HTTP_400_BAD_REQUEST)
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return token_response(serializer.validated_data['user'])


class CurrentUserView(APIView):
    def get(self, request):
        return Response({
            'id': request.user.id,
            'email': request.user.email,
            'date_joined': request.user.date_joined,
        })


class PasswordChangeView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])

        current_refresh = serializer.validated_data['refresh']
        for token in OutstandingToken.objects.filter(user=request.user).exclude(token=current_refresh):
            BlacklistedToken.objects.get_or_create(token=token)
        return Response({'detail': 'Password updated.'})


class LogoutView(APIView):
    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data['refresh']).blacklist()
        except TokenError:
            return Response({'detail': 'Refresh token is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Signed out.'})


class FarmDataView(APIView):
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
        data, _ = FarmData.objects.get_or_create(user=request.user)
        serializer = FarmDataSerializer(data, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FarmDataSerializer(data).data)