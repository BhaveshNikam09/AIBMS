# apps/business/models.py
# AIBMS – BharatSync AI
# Business Model — FIXED (added role field to BusinessMember)

import uuid
from django.db import models
from apps.users.models import User


# ─────────────────────────────────────────────
# BUSINESS CATEGORY CHOICES
# ─────────────────────────────────────────────
class BusinessCategory(models.TextChoices):
    RETAIL          = 'retail',          'Retail'
    WHOLESALE       = 'wholesale',       'Wholesale'
    MANUFACTURING   = 'manufacturing',   'Manufacturing'
    SERVICE         = 'service',         'Service'
    FOOD_BEVERAGE   = 'food_beverage',   'Food & Beverage'
    HEALTHCARE      = 'healthcare',      'Healthcare'
    EDUCATION       = 'education',       'Education'
    REAL_ESTATE     = 'real_estate',     'Real Estate'
    LOGISTICS       = 'logistics',       'Logistics'
    IT_TECHNOLOGY   = 'it_technology',   'IT & Technology'
    FINANCE         = 'finance',         'Finance'
    CONSTRUCTION    = 'construction',    'Construction'
    AGRICULTURE     = 'agriculture',     'Agriculture'
    OTHER           = 'other',           'Other'


# ─────────────────────────────────────────────
# BUSINESS STATUS
# ─────────────────────────────────────────────
class BusinessStatus(models.TextChoices):
    ACTIVE      = 'active',      'Active'
    INACTIVE    = 'inactive',    'Inactive'
    SUSPENDED   = 'suspended',   'Suspended'
    PENDING     = 'pending',     'Pending Verification'


# ─────────────────────────────────────────────
# BUSINESS MODEL
# ─────────────────────────────────────────────
class Business(models.Model):

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=255, db_index=True)
    legal_name   = models.CharField(max_length=255, blank=True)
    category     = models.CharField(
        max_length=30,
        choices=BusinessCategory.choices,
        default=BusinessCategory.OTHER,
    )
    description  = models.TextField(blank=True)

    owner = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='businesses',
        limit_choices_to={'role': 'business_owner'},
    )

    gstin           = models.CharField(max_length=15, unique=True, null=True, blank=True)
    pan             = models.CharField(max_length=10, unique=True, null=True, blank=True)
    registration_no = models.CharField(max_length=50, blank=True)
    tan             = models.CharField(max_length=10, blank=True)

    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=15, blank=True)
    website      = models.URLField(blank=True)

    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city          = models.CharField(max_length=100, blank=True)
    state         = models.CharField(max_length=100, blank=True)
    pincode       = models.CharField(max_length=10, blank=True)
    country       = models.CharField(max_length=100, default='India')

    financial_year_start = models.PositiveSmallIntegerField(
        default=4,
        help_text='Month number when financial year starts (default: 4 = April)'
    )

    logo         = models.ImageField(upload_to='business/logos/', null=True, blank=True)
    brand_color  = models.CharField(max_length=7, default='#6366f1')

    status = models.CharField(
        max_length=15,
        choices=BusinessStatus.choices,
        default=BusinessStatus.PENDING,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table         = 'businesses'
        verbose_name     = 'Business'
        verbose_name_plural = 'Businesses'
        ordering         = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.owner.full_name})"

    @property
    def total_branches(self):
        return self.branches.count()

    @property
    def active_branches(self):
        return self.branches.filter(is_active=True).count()

    @property
    def full_address(self):
        parts = filter(None, [
            self.address_line1,
            self.address_line2,
            self.city,
            self.state,
            self.pincode,
            self.country,
        ])
        return ', '.join(parts)


# ─────────────────────────────────────────────
# BUSINESS MEMBER — FIXED: added role field
# ─────────────────────────────────────────────
class BusinessMember(models.Model):

    class MemberStatus(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        INACTIVE = 'inactive', 'Inactive'
        INVITED  = 'invited',  'Invited'

    # ── NEW: Role within this specific business ───
    class MemberRole(models.TextChoices):
        OWNER          = 'business_owner',  'Business Owner'   # ← Co-owner / Partner
        BRANCH_MANAGER = 'branch_manager',  'Branch Manager'
        ACCOUNTANT     = 'accountant',      'Accountant'
        STAFF          = 'staff',           'Staff'
        CA             = 'ca',              'CA / Consultant'

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user     = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='business_memberships',
    )

    # ── Role this member holds in THIS business ───
    role = models.CharField(
        max_length=20,
        choices=MemberRole.choices,
        default=MemberRole.STAFF,
        db_index=True,
    )

    status   = models.CharField(
        max_length=10,
        choices=MemberStatus.choices,
        default=MemberStatus.ACTIVE,
    )
    joined_at  = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sent_invitations',
    )

    class Meta:
        db_table        = 'business_members'
        unique_together = ('business', 'user')
        ordering        = ['-joined_at']

    def __str__(self):
        return f"{self.user.full_name} @ {self.business.name} ({self.role})"

    @property
    def is_owner(self):
        return self.role == self.MemberRole.OWNER


# ─────────────────────────────────────────────
# BUSINESS SETTINGS
# ─────────────────────────────────────────────
class BusinessSettings(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        related_name='settings',
    )

    enable_cashbook    = models.BooleanField(default=True)
    enable_documents   = models.BooleanField(default=True)
    enable_itr         = models.BooleanField(default=True)
    enable_ai_chatbot  = models.BooleanField(default=True)

    notify_on_entry    = models.BooleanField(default=True)
    notify_on_document = models.BooleanField(default=True)

    currency        = models.CharField(max_length=5, default='INR')
    currency_symbol = models.CharField(max_length=5, default='₹')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'business_settings'

    def __str__(self):
        return f"Settings → {self.business.name}"