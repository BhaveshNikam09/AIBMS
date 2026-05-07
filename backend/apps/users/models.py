# Users models
# apps/users/models.py
# AIBMS – BharatSync AI
# Custom User Model with Role-Based Access Control

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


# ─────────────────────────────────────────────
# ROLE CHOICES
# ─────────────────────────────────────────────
class UserRole(models.TextChoices):
    SUPER_ADMIN   = 'super_admin',   'Super Admin'       # Anthropic/Platform level
    BUSINESS_OWNER = 'business_owner', 'Business Owner'  # Owns one or more businesses
    BRANCH_MANAGER = 'branch_manager', 'Branch Manager'  # Manages a specific branch
    ACCOUNTANT    = 'accountant',    'Accountant'        # Cashbook & financial access
    STAFF         = 'staff',         'Staff'             # Limited read-only access
    CA            = 'ca',            'CA / Consultant'   # ITR & AI chatbot access


# ─────────────────────────────────────────────
# CUSTOM USER MANAGER
# ─────────────────────────────────────────────
class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is required.')
        email = self.normalize_email(email)
        extra_fields.setdefault('is_active', True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.SUPER_ADMIN)
        extra_fields.setdefault('is_verified', True)

        if not extra_fields.get('is_staff'):
            raise ValueError('Superuser must have is_staff=True.')
        if not extra_fields.get('is_superuser'):
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


# ─────────────────────────────────────────────
# CUSTOM USER MODEL
# ─────────────────────────────────────────────
class User(AbstractBaseUser, PermissionsMixin):

    # ── Identity ──────────────────────────────
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email      = models.EmailField(unique=True, db_index=True)
    phone      = models.CharField(max_length=15, unique=True, null=True, blank=True)
    full_name  = models.CharField(max_length=150)

    # ── Role ──────────────────────────────────
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STAFF,
        db_index=True,
    )

    # ── Profile ───────────────────────────────
    profile_picture = models.ImageField(
        upload_to='profiles/',
        null=True,
        blank=True,
    )
    designation     = models.CharField(max_length=100, blank=True)
    date_of_joining = models.DateField(null=True, blank=True)

    # ── Status ────────────────────────────────
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)   # Email/phone verified

    # ── Timestamps ────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # ── Manager & Auth ────────────────────────
    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table  = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.email}) – {self.role}"

    # ── Role Helper Properties ─────────────────
    @property
    def is_super_admin(self):
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_business_owner(self):
        return self.role == UserRole.BUSINESS_OWNER

    @property
    def is_branch_manager(self):
        return self.role == UserRole.BRANCH_MANAGER

    @property
    def is_accountant(self):
        return self.role == UserRole.ACCOUNTANT

    @property
    def is_ca(self):
        return self.role == UserRole.CA

    @property
    def is_staff_member(self):
        return self.role == UserRole.STAFF


# ─────────────────────────────────────────────
# OTP MODEL – for email/phone verification
# ─────────────────────────────────────────────
class OTP(models.Model):

    class OTPPurpose(models.TextChoices):
        EMAIL_VERIFY    = 'email_verify',    'Email Verification'
        PHONE_VERIFY    = 'phone_verify',    'Phone Verification'
        PASSWORD_RESET  = 'password_reset',  'Password Reset'
        TWO_FACTOR      = 'two_factor',      '2FA Login'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otps')
    code       = models.CharField(max_length=6)
    purpose    = models.CharField(max_length=20, choices=OTPPurpose.choices)
    is_used    = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_otps'
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP({self.purpose}) → {self.user.email}"

    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and self.expires_at > timezone.now()


# ─────────────────────────────────────────────
# USER ACTIVITY LOG
# ─────────────────────────────────────────────
class UserActivityLog(models.Model):

    class Action(models.TextChoices):
        LOGIN         = 'login',          'Login'
        LOGOUT        = 'logout',         'Logout'
        PASSWORD_RESET = 'password_reset', 'Password Reset'
        PROFILE_UPDATE = 'profile_update', 'Profile Update'
        FAILED_LOGIN  = 'failed_login',   'Failed Login Attempt'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action     = models.CharField(max_length=30, choices=Action.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata   = models.JSONField(default=dict, blank=True)   # Extra context
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_activity_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.email} – {self.action} at {self.timestamp}"