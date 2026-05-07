# apps/authentication/utils.py
# AIBMS – BharatSync AI
# Authentication — OTP Generator & Helpers

import random
import logging
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# OTP GENERATOR
# ─────────────────────────────────────────────
def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


# ─────────────────────────────────────────────
# CREATE OTP
# ─────────────────────────────────────────────
def create_otp(user, otp_type: str, expiry_minutes: int = 10):
    """
    Create a new OTP for the user.
    Expires old pending OTPs of same type first.
    """
    from .models import OTPVerification

    # Expire old OTPs of same type
    OTPVerification.objects.filter(
        user     = user,
        otp_type = otp_type,
        status   = OTPVerification.OTPStatus.PENDING,
    ).update(status=OTPVerification.OTPStatus.EXPIRED)

    otp_code = generate_otp()
    otp      = OTPVerification.objects.create(
        user       = user,
        otp_type   = otp_type,
        otp_code   = otp_code,
        status     = OTPVerification.OTPStatus.PENDING,
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes),
    )

    # Print to console since no email service
    logger.info(f"OTP for {user.email} [{otp_type}]: {otp_code}")
    print(f"\n{'='*50}")
    print(f"  OTP for {user.email}")
    print(f"  Type:    {otp_type}")
    print(f"  Code:    {otp_code}")
    print(f"  Expires: {expiry_minutes} minutes")
    print(f"{'='*50}\n")

    return otp


# ─────────────────────────────────────────────
# VERIFY OTP
# ─────────────────────────────────────────────
def verify_otp(user, otp_type: str, otp_code: str) -> tuple:
    """
    Verify OTP code.
    Returns (success: bool, message: str)
    """
    from .models import OTPVerification

    try:
        otp = OTPVerification.objects.filter(
            user     = user,
            otp_type = otp_type,
            status   = OTPVerification.OTPStatus.PENDING,
        ).order_by('-created_at').first()

        if not otp:
            return False, 'No active OTP found. Please request a new one.'

        # Increment attempts
        otp.attempts += 1
        otp.save(update_fields=['attempts'])

        # Check expiry
        if otp.is_expired:
            otp.status = OTPVerification.OTPStatus.EXPIRED
            otp.save(update_fields=['status'])
            return False, 'OTP has expired. Please request a new one.'

        # Check max attempts
        if otp.attempts > 5:
            otp.status = OTPVerification.OTPStatus.EXPIRED
            otp.save(update_fields=['status'])
            return False, 'Too many incorrect attempts. Please request a new OTP.'

        # Check code
        if otp.otp_code != otp_code:
            remaining = 5 - otp.attempts
            return False, f'Invalid OTP. {remaining} attempts remaining.'

        # Mark verified
        otp.status = OTPVerification.OTPStatus.VERIFIED
        otp.save(update_fields=['status'])
        return True, 'OTP verified successfully.'

    except Exception as e:
        logger.error(f"OTP verify error: {e}")
        return False, 'OTP verification failed. Please try again.'


# ─────────────────────────────────────────────
# GET TOKENS FOR USER
# ─────────────────────────────────────────────
def get_tokens_for_user(user) -> dict:
    """Generate JWT access and refresh tokens for user."""
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    return {
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
    }


# ─────────────────────────────────────────────
# USER RESPONSE DATA
# ─────────────────────────────────────────────
def get_user_data(user) -> dict:
    """Return safe user data dict for API responses."""
    doj = getattr(user, 'date_of_joining', None) or getattr(user, 'created_at', None)

    # Get business_id and business_role from membership
    business_id   = ''
    business_role = ''   # role within this specific business
    try:
        biz = user.businesses.first()
        if biz:
            business_id   = str(biz.id)
            business_role = 'owner'   # They own the business
    except Exception:
        pass

    if not business_id:
        try:
            from apps.business.models import BusinessMember
            membership = BusinessMember.objects.filter(
                user=user, status='active'
            ).select_related('business').first()
            if membership:
                business_id   = str(membership.business.id)
                # Map BusinessMember.MemberRole to sidebar-friendly role names
                ROLE_MAP = {
                    'business_owner': 'owner',
                    'branch_manager': 'manager',
                    'accountant':     'accountant',
                    'staff':          'staff',
                    'ca':             'accountant',  # CA gets accountant-level access
                }
                business_role = ROLE_MAP.get(membership.role, membership.role)
        except Exception:
            pass

    return {
        'id':                str(user.id),
        'email':             user.email,
        'full_name':         getattr(user, 'full_name', ''),
        'phone':             getattr(user, 'phone', ''),
        'role':              getattr(user, 'role', ''),
        'business_role':     business_role,   # ← scoped role within the business
        'is_email_verified': getattr(user, 'is_verified', False),
        'is_active':         user.is_active,
        'date_joined':       str(doj.date()) if doj else '',
        'profile_picture':   str(getattr(user, 'profile_picture', '') or ''),
        'business_id':       business_id,
    }