# apps/authentication/serializers.py
# AIBMS – BharatSync AI
# Authentication Serializers — FIXED

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from apps.users.models import User


# ─────────────────────────────────────────────
# PARTNER SERIALIZER (used inside RegisterSerializer)
# ─────────────────────────────────────────────
class PartnerSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=True)
    email     = serializers.EmailField(required=True)
    phone     = serializers.CharField(required=False, allow_blank=True, default='')
    role      = serializers.ChoiceField(
        choices=[
            'business_owner',   # ← Partner can be co-owner
            'branch_manager',
            'accountant',
            'staff',
            'ca',
        ],
        default='business_owner',  # ← Default partner role is co-owner
    )

    def validate_email(self, value):
        return value.strip().lower()

    def validate_phone(self, value):
        return value.strip() if value else ''


# ─────────────────────────────────────────────
# REGISTER
# ─────────────────────────────────────────────
class RegisterSerializer(serializers.ModelSerializer):
    password         = serializers.CharField(
        write_only = True,
        required   = True,
        validators = [validate_password],
    )
    confirm_password = serializers.CharField(
        write_only = True,
        required   = True,
    )
    # Partners field — list of co-owners/partners added during registration
    partners = PartnerSerializer(many=True, required=False, default=list)

    class Meta:
        model  = User
        fields = [
            'email',
            'full_name',
            'phone',
            'password',
            'confirm_password',
            'partners',          # ← NEW
        ]
        extra_kwargs = {
            'email':     {'required': True},
            'full_name': {'required': True},
            'phone':     {'required': False, 'allow_blank': True},
        }

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError(
                'A user with this email already exists.'
            )
        return value.lower()

    def validate_phone(self, value):
        """Normalize empty phone to None to avoid unique constraint on blank string."""
        if not value or not value.strip():
            return None
        return value.strip()

    def validate_partners(self, partners):
        """Validate no duplicate emails in partners list, and not same as owner email."""
        emails = []
        for p in partners:
            email = p.get('email', '').lower()
            if email in emails:
                raise serializers.ValidationError(
                    f'Duplicate partner email: {email}'
                )
            emails.append(email)
        return partners

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })

        # Normalize phone to None if blank
        if not attrs.get('phone'):
            attrs['phone'] = None

        # Ensure owner email not in partners
        owner_email = attrs.get('email', '').lower()
        for p in attrs.get('partners', []):
            if p.get('email', '').lower() == owner_email:
                raise serializers.ValidationError({
                    'partners': 'Partner email cannot be same as your email.'
                })

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        partners = validated_data.pop('partners', [])   # Extract partners
        password = validated_data.pop('password')

        # Normalize phone
        if not validated_data.get('phone'):
            validated_data['phone'] = None

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Store partners on instance so the view can use it
        self._partners = partners
        return user


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────
class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        return value.lower()


# ─────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────
class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)


# ─────────────────────────────────────────────
# CHANGE PASSWORD
# ─────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):
    old_password     = serializers.CharField(required=True, write_only=True)
    new_password     = serializers.CharField(
        required   = True,
        write_only = True,
        validators = [validate_password],
    )
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })
        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError({
                'new_password': 'New password cannot be same as old password.'
            })
        return attrs


# ─────────────────────────────────────────────
# FORGOT PASSWORD
# ─────────────────────────────────────────────
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.lower()


# ─────────────────────────────────────────────
# VERIFY OTP
# ─────────────────────────────────────────────
class VerifyOTPSerializer(serializers.Serializer):
    email    = serializers.EmailField(required=True)
    otp_code = serializers.CharField(required=True, min_length=6, max_length=6)
    otp_type = serializers.CharField(required=True)

    def validate_email(self, value):
        return value.lower()

    def validate_otp_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('OTP must be 6 digits.')
        return value


# ─────────────────────────────────────────────
# RESET PASSWORD
# ─────────────────────────────────────────────
class ResetPasswordSerializer(serializers.Serializer):
    email            = serializers.EmailField(required=True)
    otp_code         = serializers.CharField(required=True, min_length=6, max_length=6)
    new_password     = serializers.CharField(
        required   = True,
        write_only = True,
        validators = [validate_password],
    )
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        return value.lower()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })
        return attrs


# ─────────────────────────────────────────────
# VERIFY EMAIL
# ─────────────────────────────────────────────
class VerifyEmailSerializer(serializers.Serializer):
    email    = serializers.EmailField(required=True)
    otp_code = serializers.CharField(required=True, min_length=6, max_length=6)

    def validate_email(self, value):
        return value.lower()


# ─────────────────────────────────────────────
# PROFILE UPDATE
# ─────────────────────────────────────────────
class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            'full_name',
            'phone',
            'profile_picture',
        ]
        extra_kwargs = {
            'full_name':       {'required': False},
            'phone':           {'required': False},
            'profile_picture': {'required': False},
        }


# ─────────────────────────────────────────────
# PROFILE RESPONSE
# ─────────────────────────────────────────────
class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            'id',
            'email',
            'full_name',
            'phone',
            'role',
            'is_email_verified',
            'is_active',
            'date_joined',
            'profile_picture',
        ]
        read_only_fields = [
            'id',
            'email',
            'role',
            'is_email_verified',
            'is_active',
            'date_joined',
        ]


# ─────────────────────────────────────────────
# RESEND OTP
# ─────────────────────────────────────────────
class ResendOTPSerializer(serializers.Serializer):
    email    = serializers.EmailField(required=True)
    otp_type = serializers.CharField(required=True)

    def validate_email(self, value):
        return value.lower()

    def validate_otp_type(self, value):
        valid_types = ['email_verify', 'forgot_password', 'change_email']
        if value not in valid_types:
            raise serializers.ValidationError(
                f'Invalid OTP type. Must be one of: {valid_types}'
            )
        return value