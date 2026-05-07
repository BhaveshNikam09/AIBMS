# apps/users/serializers.py
# AIBMS –AIBMS
# User Serializers

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, OTP, UserActivityLog, UserRole


# ─────────────────────────────────────────────
# REGISTER SERIALIZER
# ─────────────────────────────────────────────
class RegisterSerializer(serializers.ModelSerializer):

    password         = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = [
            'email', 'phone', 'full_name', 'role',
            'password', 'confirm_password',
        ]
        extra_kwargs = {
            'role':  {'required': False},
            'phone': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.strip().lower()

    def validate_phone(self, value):
        if value and value.strip():
            clean = value.strip()
            if User.objects.filter(phone=clean).exists():
                raise serializers.ValidationError("This phone number is already registered.")
            return clean
        # Return None so it's treated as blank/null — avoids unique constraint on empty string
        return None

    def validate_role(self, value):
        if value == UserRole.SUPER_ADMIN:
            raise serializers.ValidationError("Cannot self-assign Super Admin role.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        # Clean up blank phone so it doesn't hit the unique constraint
        if 'phone' in attrs and not attrs['phone']:
            attrs['phone'] = None
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        # Default role to business_owner for self-registration
        validated_data.setdefault('role', UserRole.BUSINESS_OWNER)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ─────────────────────────────────────────────
# LOGIN SERIALIZER
# ─────────────────────────────────────────────
class LoginSerializer(serializers.Serializer):

    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email    = attrs.get('email', '').strip().lower()
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            username=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                {"non_field_errors": "Invalid email or password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": "Your account has been deactivated."}
            )

        refresh = RefreshToken.for_user(user)

        return {
            'user':          user,
            'access_token':  str(refresh.access_token),
            'refresh_token': str(refresh),
        }


# ─────────────────────────────────────────────
# USER PROFILE SERIALIZER (read)
# ─────────────────────────────────────────────
class UserProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'phone', 'full_name', 'role',
            'profile_picture', 'designation', 'date_of_joining',
            'is_active', 'is_verified', 'created_at', 'last_login',
        ]
        read_only_fields = [
            'id', 'email', 'role', 'is_verified', 'created_at', 'last_login',
        ]


# ─────────────────────────────────────────────
# UPDATE PROFILE SERIALIZER
# ─────────────────────────────────────────────
class UpdateProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model  = User
        fields = [
            'full_name', 'phone', 'profile_picture',
            'designation', 'date_of_joining',
        ]

    def validate_phone(self, value):
        if value:
            qs = User.objects.filter(phone=value).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "This phone number is already registered."
                )
        return value


# ─────────────────────────────────────────────
# CHANGE PASSWORD SERIALIZER
# ─────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):

    old_password     = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


# ─────────────────────────────────────────────
# OTP SERIALIZER
# ─────────────────────────────────────────────
class OTPVerifySerializer(serializers.Serializer):

    email   = serializers.EmailField()
    code    = serializers.CharField(max_length=6, min_length=6)
    purpose = serializers.ChoiceField(choices=OTP.OTPPurpose.choices)

    def validate(self, attrs):
        try:
            user = User.objects.get(email__iexact=attrs['email'].strip())
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User not found."})

        otp = OTP.objects.filter(
            user    = user,
            code    = attrs['code'],
            purpose = attrs['purpose'],
            is_used = False,
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid():
            raise serializers.ValidationError(
                {"code": "Invalid or expired OTP."}
            )

        attrs['user'] = user
        attrs['otp']  = otp
        return attrs


# ─────────────────────────────────────────────
# FORGOT PASSWORD SERIALIZER
# ─────────────────────────────────────────────
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError("No account found with this email.")
        return value.strip().lower()


# ─────────────────────────────────────────────
# RESET PASSWORD SERIALIZER
# ─────────────────────────────────────────────
class ResetPasswordSerializer(serializers.Serializer):

    email            = serializers.EmailField()
    code             = serializers.CharField(max_length=6, min_length=6)
    new_password     = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        try:
            user = User.objects.get(email__iexact=attrs['email'].strip())
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User not found."})

        otp = OTP.objects.filter(
            user    = user,
            code    = attrs['code'],
            purpose = OTP.OTPPurpose.PASSWORD_RESET,
            is_used = False,
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid():
            raise serializers.ValidationError(
                {"code": "Invalid or expired OTP."}
            )

        attrs['user'] = user
        attrs['otp']  = otp
        return attrs

    def save(self):
        user = self.validated_data['user']
        otp  = self.validated_data['otp']

        user.set_password(self.validated_data['new_password'])
        user.save()

        otp.is_used = True
        otp.save()
        return user


# ─────────────────────────────────────────────
# USER LIST SERIALIZER (admin use)
# ─────────────────────────────────────────────
class UserListSerializer(serializers.ModelSerializer):

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'phone', 'full_name',
            'role', 'is_active', 'is_verified', 'created_at',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# ACTIVITY LOG SERIALIZER
# ─────────────────────────────────────────────
class UserActivityLogSerializer(serializers.ModelSerializer):

    class Meta:
        model  = UserActivityLog
        fields = [
            'id', 'action', 'ip_address',
            'user_agent', 'metadata', 'timestamp',
        ]
        read_only_fields = fields