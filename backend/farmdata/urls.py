from django.urls import path
from .views import (
    CsrfTokenView,
    CurrentUserView,
    FarmDataView,
    LoginView,
    LogoutView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    TokenCookieRefreshView,
)


urlpatterns = [
    path('auth/csrf/', CsrfTokenView.as_view(), name='csrf_token'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('auth/password/', PasswordChangeView.as_view(), name='change_password'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenCookieRefreshView.as_view(), name='token_refresh'),
    path('farm-data/', FarmDataView.as_view(), name='farm_data'),
]