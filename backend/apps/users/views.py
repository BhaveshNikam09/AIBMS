# apps/users/views.py
# AIBMS –AIBMS
# User Views

import random
import string
from datetime import timedelta

from django.utils import timezone
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from utils.response import success_response, error_response
from .models import User, OTP, UserActivityLog, UserRole
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    OTPVerifySerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    UserListSerializer,
    UserActivityLogSerializer,
)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_activity(user, action, request, metadata=None):
    UserActivityLog.objects.create(
        user       = user,
        action     = action,
        ip_address = get_client_ip(request),
        user_agent = request.META.get('HTTP_USER_AGENT', ''),
        metadata   = metadata or {},
    )


# ─────────────────────────────────────────────
# REGISTER
# ─────────────────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Registration failed.",
                errors=serializer.errors,
                status=400,
            )

        user = serializer.save()

        # Generate JWT tokens immediately so frontend can proceed without
        # a separate login step (token is needed to create the business)
        refresh      = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Generate email verification OTP
        otp_code = generate_otp()
        OTP.objects.create(
            user       = user,
            code       = otp_code,
            purpose    = OTP.OTPPurpose.EMAIL_VERIFY,
            expires_at = timezone.now() + timedelta(minutes=10),
        )

        # TODO: Send OTP via email service
        return success_response(
            data={
                "user_id": str(user.id),
                "email":   user.email,
                "otp":     otp_code,   # Remove in production
                "tokens": {
                    "access":  access_token,
                    "refresh": refresh_token,
                },
                "user": UserProfileSerializer(user).data,
            },
            message="Registration successful. Please verify your email.",
            status=201,
        )


# ─────────────────────────────────────────────
# VERIFY EMAIL OTP
# ─────────────────────────────────────────────
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data={
            **request.data,
            'purpose': OTP.OTPPurpose.EMAIL_VERIFY,
        })

        if not serializer.is_valid():
            return error_response(
                message="OTP verification failed.",
                errors=serializer.errors,
            )

        user = serializer.validated_data['user']
        otp  = serializer.validated_data['otp']

        user.is_verified = True
        user.save(update_fields=['is_verified'])

        otp.is_used = True
        otp.save(update_fields=['is_used'])

        return success_response(message="Email verified successfully.")


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={'request': request},
        )

        if not serializer.is_valid():
            email = request.data.get('email', '')
            user  = User.objects.filter(email__iexact=email.strip()).first()
            if user:
                log_activity(
                    user, UserActivityLog.Action.FAILED_LOGIN, request
                )
            return error_response(
                message="Login failed.",
                errors=serializer.errors,
            )

        data = serializer.validated_data
        user = data['user']

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        log_activity(user, UserActivityLog.Action.LOGIN, request)

        return success_response(
            data={
                "access_token":  data['access_token'],
                "refresh_token": data['refresh_token'],
                "user": UserProfileSerializer(user).data,
            },
            message="Login successful.",
        )


# ─────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return error_response(message="Refresh token is required.")

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as e:
            return error_response(message=str(e))

        log_activity(request.user, UserActivityLog.Action.LOGOUT, request)

        return success_response(message="Logged out successfully.")


# ─────────────────────────────────────────────
# FORGOT PASSWORD
# ─────────────────────────────────────────────
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Request failed.",
                errors=serializer.errors,
            )

        user = User.objects.get(email__iexact=serializer.validated_data['email'])

        OTP.objects.filter(
            user    = user,
            purpose = OTP.OTPPurpose.PASSWORD_RESET,
            is_used = False,
        ).update(is_used=True)

        otp_code = generate_otp()
        OTP.objects.create(
            user       = user,
            code       = otp_code,
            purpose    = OTP.OTPPurpose.PASSWORD_RESET,
            expires_at = timezone.now() + timedelta(minutes=10),
        )

        # TODO: Send via email service
        return success_response(
            data={"otp": otp_code},   # Remove in production
            message="OTP sent to your registered email.",
        )


# ─────────────────────────────────────────────
# RESET PASSWORD
# ─────────────────────────────────────────────
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Password reset failed.",
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(message="Password reset successful. Please login.")


# ─────────────────────────────────────────────
# MY PROFILE
# ─────────────────────────────────────────────
class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return success_response(data=serializer.data)

    def patch(self, request):
        serializer = UpdateProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Profile update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        log_activity(
            request.user,
            UserActivityLog.Action.PROFILE_UPDATE,
            request,
        )
        return success_response(
            data=UserProfileSerializer(request.user).data,
            message="Profile updated successfully.",
        )


# ─────────────────────────────────────────────
# CHANGE PASSWORD
# ─────────────────────────────────────────────
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response(
                message="Password change failed.",
                errors=serializer.errors,
            )

        serializer.save()
        log_activity(
            request.user,
            UserActivityLog.Action.PASSWORD_RESET,
            request,
        )
        return success_response(message="Password changed successfully.")


# ─────────────────────────────────────────────
# USER LIST (Super Admin only)
# ─────────────────────────────────────────────
class UserListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserListSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_super_admin:
            return User.objects.none()
        return User.objects.all().order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page     = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data=serializer.data)


# ─────────────────────────────────────────────
# USER DETAIL (Super Admin only)
# ─────────────────────────────────────────────
class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        if not request.user.is_super_admin:
            return error_response(message="Permission denied.", status=403)

        user = self.get_object(pk)
        if not user:
            return error_response(message="User not found.", status=404)

        return success_response(data=UserProfileSerializer(user).data)

    def patch(self, request, pk):
        if not request.user.is_super_admin:
            return error_response(message="Permission denied.", status=403)

        user = self.get_object(pk)
        if not user:
            return error_response(message="User not found.", status=404)

        serializer = UpdateProfileSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(errors=serializer.errors)

        serializer.save()
        return success_response(
            data=UserProfileSerializer(user).data,
            message="User updated successfully.",
        )

    def delete(self, request, pk):
        if not request.user.is_super_admin:
            return error_response(message="Permission denied.", status=403)

        user = self.get_object(pk)
        if not user:
            return error_response(message="User not found.", status=404)

        user.is_active = False
        user.save(update_fields=['is_active'])
        return success_response(message="User deactivated successfully.")


# ─────────────────────────────────────────────
# ACTIVITY LOGS (own logs)
# ─────────────────────────────────────────────
class MyActivityLogView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserActivityLogSerializer

    def get_queryset(self):
        return UserActivityLog.objects.filter(
            user=self.request.user
        ).order_by('-timestamp')[:50]

    def list(self, request, *args, **kwargs):
        queryset   = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data=serializer.data)