# apps/users/urls.py
# AIBMS –AIBMS
# User URL Patterns

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    VerifyEmailView,
    LoginView,
    LogoutView,
    ForgotPasswordView,
    ResetPasswordView,
    MyProfileView,
    ChangePasswordView,
    UserListView,
    UserDetailView,
    MyActivityLogView,
)

urlpatterns = [

    # ── Authentication ────────────────────────
    path('register/',        RegisterView.as_view(),       name='user-register'),
    path('verify-email/',    VerifyEmailView.as_view(),     name='user-verify-email'),
    path('login/',           LoginView.as_view(),           name='user-login'),
    path('logout/',          LogoutView.as_view(),          name='user-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),    name='token-refresh'),

    # ── Password Management ───────────────────
    path('forgot-password/', ForgotPasswordView.as_view(),  name='user-forgot-password'),
    path('reset-password/',  ResetPasswordView.as_view(),   name='user-reset-password'),
    path('change-password/', ChangePasswordView.as_view(),  name='user-change-password'),

    # ── Profile ───────────────────────────────
    path('me/',              MyProfileView.as_view(),        name='user-profile'),
    path('me/activity/',     MyActivityLogView.as_view(),    name='user-activity'),

    # ── Admin – User Management ───────────────
    path('',                 UserListView.as_view(),         name='user-list'),
    path('<uuid:pk>/',       UserDetailView.as_view(),       name='user-detail'),
]