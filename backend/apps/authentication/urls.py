# apps/authentication/urls.py
# AIBMS – BharatSync AI
# Authentication URLs

from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    TokenRefreshView,
    ChangePasswordView,
    ForgotPasswordView,
    VerifyOTPView,
    ResetPasswordView,
    VerifyEmailView,
    ResendOTPView,
    ProfileView,
    MeView,
)

app_name = 'authentication'

urlpatterns = [

    # ── Register & Login ──────────────────────
    path(
        'register/',
        RegisterView.as_view(),
        name='register',
    ),
    path(
        'login/',
        LoginView.as_view(),
        name='login',
    ),
    path(
        'logout/',
        LogoutView.as_view(),
        name='logout',
    ),

    # ── Token ─────────────────────────────────
    path(
        'token/refresh/',
        TokenRefreshView.as_view(),
        name='token-refresh',
    ),

    # ── Password ──────────────────────────────
    path(
        'change-password/',
        ChangePasswordView.as_view(),
        name='change-password',
    ),
    path(
        'forgot-password/',
        ForgotPasswordView.as_view(),
        name='forgot-password',
    ),
    path(
        'reset-password/',
        ResetPasswordView.as_view(),
        name='reset-password',
    ),

    # ── OTP ───────────────────────────────────
    path(
        'verify-otp/',
        VerifyOTPView.as_view(),
        name='verify-otp',
    ),
    path(
        'resend-otp/',
        ResendOTPView.as_view(),
        name='resend-otp',
    ),

    # ── Email Verification ────────────────────
    path(
        'verify-email/',
        VerifyEmailView.as_view(),
        name='verify-email',
    ),

    # ── Profile ───────────────────────────────
    path(
        'profile/',
        ProfileView.as_view(),
        name='profile',
    ),
    path(
        'me/',
        MeView.as_view(),
        name='me',
    ),
]