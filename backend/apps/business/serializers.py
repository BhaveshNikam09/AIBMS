# apps/business/serializers.py
# AIBMS – BharatSync AI
# Business Serializers — FIXED (auto-links partners as BusinessMembers)

import re
from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from apps.users.models import User, UserRole
from .models import Business, BusinessMember, BusinessSettings, BusinessCategory, BusinessStatus


# ─────────────────────────────────────────────
# VALIDATORS
# ─────────────────────────────────────────────
def validate_gstin(value):
    if value:
        pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if not re.match(pattern, value.upper()):
            raise serializers.ValidationError("Invalid GSTIN format.")
    return value.upper() if value else value


def validate_pan(value):
    if value:
        pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
        if not re.match(pattern, value.upper()):
            raise serializers.ValidationError("Invalid PAN format.")
    return value.upper() if value else value


# ─────────────────────────────────────────────
# BUSINESS SETTINGS SERIALIZER
# ─────────────────────────────────────────────
class BusinessSettingsSerializer(serializers.ModelSerializer):

    class Meta:
        model  = BusinessSettings
        fields = [
            'enable_cashbook', 'enable_documents',
            'enable_itr', 'enable_ai_chatbot',
            'notify_on_entry', 'notify_on_document',
            'currency', 'currency_symbol',
            'updated_at',
        ]
        read_only_fields = ['updated_at']


# ─────────────────────────────────────────────
# BUSINESS CREATE SERIALIZER
# ─────────────────────────────────────────────
class BusinessCreateSerializer(serializers.ModelSerializer):

    gstin = serializers.CharField(required=False, allow_blank=True)
    pan   = serializers.CharField(required=False, allow_blank=True)

    # Accept list of partner user_ids (returned from register step)
    # Frontend passes these after registration
    partner_user_ids = serializers.ListField(
        child    = serializers.UUIDField(),
        required = False,
        default  = list,
        write_only = True,
    )

    class Meta:
        model  = Business
        fields = [
            'name', 'legal_name', 'category', 'description',
            'gstin', 'pan', 'registration_no', 'tan',
            'email', 'phone', 'website',
            'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'financial_year_start',
            'logo', 'brand_color',
            'partner_user_ids',   # ← NEW: frontend passes partner IDs here
        ]

    def validate_gstin(self, value):
        if value:
            qs = Business.objects.filter(gstin=value.upper())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A business with this GSTIN already exists."
                )
        return validate_gstin(value)

    def validate_pan(self, value):
        if value:
            qs = Business.objects.filter(pan=value.upper())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A business with this PAN already exists."
                )
        return validate_pan(value)

    def validate_financial_year_start(self, value):
        if value not in range(1, 13):
            raise serializers.ValidationError(
                "Financial year start must be a valid month (1-12)."
            )
        return value

    def validate_brand_color(self, value):
        if value and not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError(
                "Brand color must be a valid hex color (e.g. #6366f1)."
            )
        return value

    def create(self, validated_data):
        owner            = self.context['request'].user
        partner_user_ids = validated_data.pop('partner_user_ids', [])

        business = Business.objects.create(owner=owner, **validated_data)

        # Auto-create default settings
        BusinessSettings.objects.create(business=business)

        # Auto-add owner as member with role = business_owner
        BusinessMember.objects.create(
            business   = business,
            user       = owner,
            role       = BusinessMember.MemberRole.OWNER,
            invited_by = owner,
            status     = BusinessMember.MemberStatus.ACTIVE,
        )

        # ── Link partners to this business ────────────────────────────
        # These users were already created in the register step.
        # We just add them as BusinessMembers now.
        for partner_id in partner_user_ids:
            try:
                partner_user = User.objects.get(id=partner_id)
            except User.DoesNotExist:
                continue  # Skip invalid IDs silently

            # Map user's global role to BusinessMember role
            role_map = {
                UserRole.BUSINESS_OWNER:  BusinessMember.MemberRole.OWNER,
                UserRole.BRANCH_MANAGER:  BusinessMember.MemberRole.BRANCH_MANAGER,
                UserRole.ACCOUNTANT:      BusinessMember.MemberRole.ACCOUNTANT,
                UserRole.STAFF:           BusinessMember.MemberRole.STAFF,
                UserRole.CA:              BusinessMember.MemberRole.CA,
            }
            member_role = role_map.get(partner_user.role, BusinessMember.MemberRole.STAFF)

            BusinessMember.objects.get_or_create(
                business = business,
                user     = partner_user,
                defaults = {
                    'role':       member_role,
                    'invited_by': owner,
                    'status':     BusinessMember.MemberStatus.ACTIVE,  # ← FIXED: active immediately
                }
            )

        return business


# ─────────────────────────────────────────────
# BUSINESS LIST SERIALIZER (lightweight)
# ─────────────────────────────────────────────
class BusinessListSerializer(serializers.ModelSerializer):

    total_branches  = serializers.ReadOnlyField()
    active_branches = serializers.ReadOnlyField()
    owner_name      = serializers.CharField(source='owner.full_name', read_only=True)

    class Meta:
        model  = Business
        fields = [
            'id', 'name', 'legal_name', 'category',
            'owner_name', 'gstin', 'status',
            'city', 'state',
            'total_branches', 'active_branches',
            'logo', 'brand_color',
            'created_at',
        ]


# ─────────────────────────────────────────────
# BUSINESS DETAIL SERIALIZER (full)
# ─────────────────────────────────────────────
class BusinessDetailSerializer(serializers.ModelSerializer):

    owner           = UserProfileSerializer(read_only=True)
    settings        = BusinessSettingsSerializer(read_only=True)
    total_branches  = serializers.ReadOnlyField()
    active_branches = serializers.ReadOnlyField()
    full_address    = serializers.ReadOnlyField()

    class Meta:
        model  = Business
        fields = [
            'id', 'name', 'legal_name', 'category', 'description',
            'owner',
            'gstin', 'pan', 'registration_no', 'tan',
            'email', 'phone', 'website',
            'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'full_address',
            'financial_year_start',
            'logo', 'brand_color', 'status',
            'total_branches', 'active_branches',
            'settings',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'status', 'created_at', 'updated_at']


# ─────────────────────────────────────────────
# BUSINESS UPDATE SERIALIZER
# ─────────────────────────────────────────────
class BusinessUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Business
        fields = [
            'name', 'legal_name', 'category', 'description',
            'gstin', 'pan', 'registration_no', 'tan',
            'email', 'phone', 'website',
            'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'financial_year_start',
            'logo', 'brand_color',
        ]

    def validate_gstin(self, value):
        if value:
            qs = Business.objects.filter(gstin=value.upper()).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A business with this GSTIN already exists."
                )
        return validate_gstin(value)

    def validate_pan(self, value):
        if value:
            qs = Business.objects.filter(pan=value.upper()).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A business with this PAN already exists."
                )
        return validate_pan(value)


# ─────────────────────────────────────────────
# BUSINESS MEMBER SERIALIZER
# ─────────────────────────────────────────────
class BusinessMemberSerializer(serializers.ModelSerializer):

    user       = UserProfileSerializer(read_only=True)
    invited_by = serializers.CharField(source='invited_by.full_name', read_only=True)
    branch     = serializers.SerializerMethodField()

    class Meta:
        model  = BusinessMember
        fields = [
            'id', 'user', 'role', 'status',
            'joined_at', 'invited_by', 'branch'
        ]
        read_only_fields = fields

    def get_branch(self, obj):
        from apps.branches.models import BranchMember
        branch_member = BranchMember.objects.filter(user=obj.user, branch__business=obj.business).first()
        if branch_member:
            return {
                'id': str(branch_member.branch.id),
                'name': branch_member.branch.name
            }
        return None


# ─────────────────────────────────────────────
# ADD MEMBER SERIALIZER
# ─────────────────────────────────────────────
class AddMemberSerializer(serializers.Serializer):

    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                "No user found with this email."
            )

        business = self.context['business']
        if BusinessMember.objects.filter(business=business, user=user).exists():
            raise serializers.ValidationError(
                "This user is already a member of this business."
            )

        self.context['member_user'] = user
        return value

    def save(self):
        business   = self.context['business']
        user       = self.context['member_user']
        invited_by = self.context['request'].user

        return BusinessMember.objects.create(
            business   = business,
            user       = user,
            invited_by = invited_by,
        )


# ─────────────────────────────────────────────
# BUSINESS SETTINGS UPDATE SERIALIZER
# ─────────────────────────────────────────────
class UpdateBusinessSettingsSerializer(serializers.ModelSerializer):

    class Meta:
        model  = BusinessSettings
        fields = [
            'enable_cashbook', 'enable_documents',
            'enable_itr', 'enable_ai_chatbot',
            'notify_on_entry', 'notify_on_document',
            'currency', 'currency_symbol',
        ]