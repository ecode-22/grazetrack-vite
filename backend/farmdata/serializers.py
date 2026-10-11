from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import FarmData


User = get_user_model()


class AccountSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        return value.strip().lower()


class RegistrationSerializer(AccountSerializer):
    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        email = validated_data['email']
        return User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
        )

    def validate_email(self, value):
        value = super().validate_email(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value


class LoginSerializer(AccountSerializer):
    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            username=attrs['email'],
            password=attrs['password'],
        )
        if user is None:
            raise serializers.ValidationError({'detail': 'Email or password is incorrect.'})
        attrs['user'] = user
        return attrs


class OwnedRefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True)

    def validate_refresh(self, value):
        try:
            token = RefreshToken(value)
        except TokenError as cause:
            raise serializers.ValidationError('Refresh token is invalid or expired.') from cause
        if str(token.get('user_id')) != str(self.context['request'].user.id):
            raise serializers.ValidationError('Refresh token does not belong to this account.')
        return value


class PasswordChangeSerializer(OwnedRefreshTokenSerializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context['request'].user)
        return value


class LogoutSerializer(OwnedRefreshTokenSerializer):
    pass


class FarmDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmData
        fields = ('fields', 'events', 'groups', 'farm', 'updated_at')
        read_only_fields = ('updated_at',)