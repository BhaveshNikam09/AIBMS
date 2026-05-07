# apps/authentication/views.py
# AIBMS – BharatSync AI
# Authentication Views — FIXED (with partner creation)

import logging
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.users.models import User, UserRole
from apps.business.models import BusinessMember
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    LogoutSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    VerifyOTPSerializer,
    ResetPasswordSerializer,
    VerifyEmailSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    ResendOTPSerializer,
)
from .utils import (
    create_otp,
    verify_otp,
    get_tokens_for_user,
    get_user_data,
)
from .models import OTPVerification

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# HELPER — Create partner user accounts
# Called after registration, partners get created
# and stored. They are linked to the business once
# the owner creates the business (step 2).
# ─────────────────────────────────────────────
def _create_partner_users(partners: list) -> list:
    """
    For each partner dict, create a User if not exists.
    Returns list of dicts with user id + role for frontend to store.
    """
    created_partners = []
    for p in partners:
        email     = p.get('email', '').strip().lower()
        full_name = p.get('full_name', '').strip()
        phone     = p.get('phone', '').strip() or None
        role      = p.get('role', 'business_owner')

        if not email:
            continue

        # Create user if not already registered
        partner_user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'full_name':         full_name,
                'phone':             phone,
                'role':              role,        # Set their global role (business_owner etc.)
                'is_active':         True,
                'is_verified':       False,
            }
        )

        if created:
            # Set a temporary random password — partner must reset via forgot-password
            import secrets
            temp_password = secrets.token_urlsafe(12)
            partner_user.set_password(temp_password)
            partner_user.save()

            # Send them an OTP to verify/set password
            # (console print since no email service yet)
            create_otp(partner_user, OTPVerification.OTPType.EMAIL_VERIFY)

            print(f"\n{'='*50}")
            print(f"  PARTNER ACCOUNT CREATED")
            print(f"  Name:  {full_name}")
            print(f"  Email: {email}")
            print(f"  Role:  {role}")
            print(f"  Temp Password: {temp_password}  ← share with partner")
            print(f"{'='*50}\n")
        else:
            # User already exists — just update their role if it's being upgraded to owner
            if role == UserRole.BUSINESS_OWNER and partner_user.role != UserRole.BUSINESS_OWNER:
                partner_user.role = role
                partner_user.save(update_fields=['role'])

        created_partners.append({
            'user_id':   str(partner_user.id),
            'full_name': partner_user.full_name,
            'email':     partner_user.email,
            'role':      role,
            'is_new':    created,
        })

    return created_partners


# ─────────────────────────────────────────────
# REGISTER
# ─────────────────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Registration failed.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = serializer.save()

            # Anyone who self-registers is a business owner
            user.role = UserRole.BUSINESS_OWNER
            user.save(update_fields=['role'])

            # Generate email verification OTP
            create_otp(user, OTPVerification.OTPType.EMAIL_VERIFY)

            tokens = get_tokens_for_user(user)

            # ── Create partner accounts ────────────────────────────────
            # Partners are users added during registration.
            # Their User accounts are created now with role=business_owner (or whatever chosen).
            # They will be linked to the Business in the next step (create business).
            partners_data = getattr(serializer, '_partners', [])
            created_partners = _create_partner_users(partners_data)

            return Response({
                'success': True,
                'message': (
                    'Registration successful! '
                    'Check your console for email verification OTP.'
                ),
                'data': {
                    'user':     get_user_data(user),
                    'tokens':   tokens,
                    # Frontend must store this and pass it when creating the business
                    'partners': created_partners,
                },
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Register error: {e}")
            return Response({
                'success': False,
                'message': f'Registration failed: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Invalid data.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email    = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'No account found with this email.',
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({
                'success': False,
                'message': 'Incorrect password.',
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                'success': False,
                'message': 'Your account has been deactivated. Please contact support.',
            }, status=status.HTTP_403_FORBIDDEN)

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        tokens = get_tokens_for_user(user)

        return Response({
            'success': True,
            'message': f'Welcome back, {user.full_name or user.email}!',
            'data': {
                'user':   get_user_data(user),
                'tokens': tokens,
            },
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Refresh token is required.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh_token = serializer.validated_data['refresh']
            token         = RefreshToken(refresh_token)
            token.blacklist()

            return Response({
                'success': True,
                'message': 'Logged out successfully.',
            }, status=status.HTTP_200_OK)

        except TokenError:
            return Response({
                'success': False,
                'message': 'Invalid or expired token.',
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Logout error: {e}")
            return Response({
                'success': False,
                'message': f'Logout failed: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────
# REFRESH TOKEN
# ─────────────────────────────────────────────
class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if not refresh_token:
            return Response({
                'success': False,
                'message': 'Refresh token is required.',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            token  = RefreshToken(refresh_token)
            access = str(token.access_token)

            return Response({
                'success': True,
                'message': 'Token refreshed successfully.',
                'data': {
                    'access': access,
                },
            }, status=status.HTTP_200_OK)

        except TokenError:
            return Response({
                'success': False,
                'message': 'Invalid or expired refresh token. Please login again.',
            }, status=status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────
# CHANGE PASSWORD
# ─────────────────────────────────────────────
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        user         = request.user
        old_password = serializer.validated_data['old_password']
        new_password = serializer.validated_data['new_password']

        if not user.check_password(old_password):
            return Response({
                'success': False,
                'message': 'Old password is incorrect.',
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({
            'success': True,
            'message': 'Password changed successfully.',
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# FORGOT PASSWORD
# ─────────────────────────────────────────────
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']

        # Always return success (security — don't reveal if email exists)
        try:
            user = User.objects.get(email=email)
            create_otp(user, OTPVerification.OTPType.FORGOT_PASSWORD)
        except User.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': 'If this email exists, an OTP has been sent. Check the console.',
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# VERIFY OTP
# ─────────────────────────────────────────────
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Invalid data.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email    = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        otp_type = serializer.validated_data['otp_type']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'No account found with this email.',
            }, status=status.HTTP_404_NOT_FOUND)

        success, message = verify_otp(user, otp_type, otp_code)

        if not success:
            return Response({
                'success': False,
                'message': message,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'success': True,
            'message': message,
            'data': {
                'email':    email,
                'otp_type': otp_type,
                'verified': True,
            },
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# RESET PASSWORD
# ─────────────────────────────────────────────
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email        = serializer.validated_data['email']
        otp_code     = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'No account found with this email.',
            }, status=status.HTTP_404_NOT_FOUND)

        success, message = verify_otp(
            user,
            OTPVerification.OTPType.FORGOT_PASSWORD,
            otp_code,
        )

        if not success:
            return Response({
                'success': False,
                'message': message,
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({
            'success': True,
            'message': 'Password reset successfully. Please login with your new password.',
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# VERIFY EMAIL
# ─────────────────────────────────────────────
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Invalid data.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email    = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'No account found with this email.',
            }, status=status.HTTP_404_NOT_FOUND)

        if getattr(user, 'is_email_verified', False) or getattr(user, 'is_verified', False):
            return Response({
                'success': True,
                'message': 'Email is already verified.',
            }, status=status.HTTP_200_OK)

        success, message = verify_otp(
            user,
            OTPVerification.OTPType.EMAIL_VERIFY,
            otp_code,
        )

        if not success:
            return Response({
                'success': False,
                'message': message,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Handle both field names (is_email_verified or is_verified)
        if hasattr(user, 'is_email_verified'):
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])
        else:
            user.is_verified = True
            user.save(update_fields=['is_verified'])

        return Response({
            'success': True,
            'message': 'Email verified successfully!',
            'data':    get_user_data(user),
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# RESEND OTP
# ─────────────────────────────────────────────
class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Invalid data.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        email    = serializer.validated_data['email']
        otp_type = serializer.validated_data['otp_type']

        try:
            user = User.objects.get(email=email)
            create_otp(user, otp_type)
        except User.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': (
                'New OTP generated. '
                'Check the Django console for your OTP code.'
            ),
            'data': {
                'email':      email,
                'otp_type':   otp_type,
                'expires_in': '10 minutes',
            },
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# PROFILE
# ─────────────────────────────────────────────
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response({
            'success': True,
            'message': 'Profile fetched successfully.',
            'data':    serializer.data,
        }, status=status.HTTP_200_OK)

    def put(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data    = request.data,
            partial = True,
        )

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed.',
                'errors':  serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()

        return Response({
            'success': True,
            'message': 'Profile updated successfully.',
            'data':    get_user_data(request.user),
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# ME (Quick user info)
# ─────────────────────────────────────────────
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'success': True,
            'message': 'User info fetched.',
            'data':    get_user_data(request.user),
        }, status=status.HTTP_200_OK)