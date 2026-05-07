# apps/business/views.py
# AIBMS –AIBMS
# Business Views — FIXED (partners can access their business)

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import Q

from utils.response import success_response, error_response
from utils.pagination import StandardPagination
from apps.users.models import UserRole, User
from apps.branches.models import Branch, BranchMember

from .models import Business, BusinessMember, BusinessSettings
from .serializers import (
    BusinessCreateSerializer,
    BusinessListSerializer,
    BusinessDetailSerializer,
    BusinessUpdateSerializer,
    BusinessMemberSerializer,
    AddMemberSerializer,
    BusinessSettingsSerializer,
    UpdateBusinessSettingsSerializer,
)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_business_or_error(pk, user):
    try:
        business = Business.objects.get(pk=pk)
    except Business.DoesNotExist:
        return None, error_response(message="Business not found.", status=404)

    # ── FIXED: allow owner OR active member (partner/staff) ──
    if not (
        user.is_super_admin or
        business.owner == user or

        BusinessMember.objects.filter(
            business=business,
            user=user,
            status='active',
        ).exists()
    ):
        return None, error_response(message="Permission denied.", status=403)

    return business, None


def is_business_member(business, user):
    return BusinessMember.objects.filter(
        business=business,
        user=user,
        status='active',
    ).exists()


def is_owner_or_admin(business, user):
    """Modified to allow any business member to manage (per user request)."""
    if user.is_super_admin or business.owner == user:
        return True
    return is_business_member(business, user)


TEAM_MEMBER_ROLE_ALIASES = {
    'manager': UserRole.BRANCH_MANAGER,
    'branch_manager': UserRole.BRANCH_MANAGER,
    'accountant': UserRole.ACCOUNTANT,
    'staff': UserRole.STAFF,
    'ca': UserRole.CA,
    'business_owner': UserRole.BUSINESS_OWNER,
}

BRANCH_MEMBER_ROLE_BY_USER_ROLE = {
    UserRole.BRANCH_MANAGER: BranchMember.MemberRole.MANAGER,
    UserRole.ACCOUNTANT: BranchMember.MemberRole.ACCOUNTANT,
    UserRole.STAFF: BranchMember.MemberRole.STAFF,
    UserRole.CA: BranchMember.MemberRole.CA,
}


# ─────────────────────────────────────────────
# BUSINESS LIST & CREATE
# ─────────────────────────────────────────────
class BusinessListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.is_super_admin:
            queryset = Business.objects.all().select_related('owner')
        else:
            # ── FIXED: return owned + member businesses for all roles ──
            member_business_ids = BusinessMember.objects.filter(
                user=user,
                status='active',
            ).values_list('business_id', flat=True)

            queryset = Business.objects.filter(
                Q(owner=user) | Q(id__in=member_business_ids)
            ).distinct().select_related('owner')

        status_filter   = request.query_params.get('status')
        category_filter = request.query_params.get('category')
        search          = request.query_params.get('search')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        if search:
            queryset = queryset.filter(name__icontains=search)

        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = BusinessListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        user = request.user

        if not (user.is_business_owner or user.is_super_admin):
            return error_response(
                message="Only Business Owners can create a business.",
                status=403,
            )

        serializer = BusinessCreateSerializer(
            data=request.data,
            context={'request': request},
        )
        if not serializer.is_valid():
            return error_response(
                message="Business creation failed.",
                errors=serializer.errors,
            )

        business = serializer.save()
        return success_response(
            data=BusinessDetailSerializer(business).data,
            message="Business created successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# BUSINESS DETAIL, UPDATE, DELETE
# ─────────────────────────────────────────────
class BusinessDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user

        try:
            business = Business.objects.select_related(
                'owner', 'settings'
            ).get(pk=pk)
        except Business.DoesNotExist:
            return error_response(message="Business not found.", status=404)

        if not (
            user.is_super_admin or
            business.owner == user or
            is_business_member(business, user)
        ):
            return error_response(message="Permission denied.", status=403)

        return success_response(
            data=BusinessDetailSerializer(business).data
        )

    def patch(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        # Only owner or super admin can edit business details
        if not is_owner_or_admin(business, request.user):
            return error_response(message="Only the business owner can update business details.", status=403)

        serializer = BusinessUpdateSerializer(
            business,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(
            data=BusinessDetailSerializer(business).data,
            message="Business updated successfully.",
        )

    def delete(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        if not is_owner_or_admin(business, request.user):
            return error_response(message="Only the business owner can deactivate a business.", status=403)

        business.status = 'inactive'
        business.save(update_fields=['status'])
        return success_response(message="Business deactivated successfully.")


# ─────────────────────────────────────────────
# BUSINESS STATUS CHANGE (Super Admin only)
# ─────────────────────────────────────────────
class BusinessStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not request.user.is_super_admin:
            return error_response(message="Permission denied.", status=403)

        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return error_response(message="Business not found.", status=404)

        new_status     = request.data.get('status')
        valid_statuses = ['active', 'inactive', 'suspended', 'pending']

        if new_status not in valid_statuses:
            return error_response(
                message=f"Invalid status. Choose from: {', '.join(valid_statuses)}"
            )

        business.status = new_status
        business.save(update_fields=['status'])

        return success_response(
            data={'status': business.status},
            message=f"Business status updated to '{new_status}'.",
        )


# ─────────────────────────────────────────────
# BUSINESS MEMBERS — LIST & ADD EXISTING USER
# ─────────────────────────────────────────────
class BusinessMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        members = BusinessMember.objects.filter(
            business=business
        ).select_related('user', 'invited_by').order_by('-joined_at')

        serializer = BusinessMemberSerializer(members, many=True)
        return success_response(data=serializer.data)

    def post(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        if not is_owner_or_admin(business, request.user):
            return error_response(message="Only the business owner can add members.", status=403)

        serializer = AddMemberSerializer(
            data=request.data,
            context={
                'request':  request,
                'business': business,
            },
        )
        if not serializer.is_valid():
            return error_response(
                message="Failed to add member.",
                errors=serializer.errors,
            )

        member = serializer.save()
        return success_response(
            data=BusinessMemberSerializer(member).data,
            message="Member added successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# CREATE TEAM MEMBER — Owner creates new account
# ─────────────────────────────────────────────
class CreateTeamMemberView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return error_response(message="Business not found.", status=404)

        if not is_owner_or_admin(business, request.user):
            return error_response(
                message="Only the business owner can create team member accounts.",
                status=403,
            )

        full_name = str(request.data.get('full_name', '')).strip()
        email     = str(request.data.get('email', '')).strip().lower()
        password  = str(request.data.get('password', '')).strip()
        raw_role  = str(request.data.get('role', 'staff')).strip().lower()
        role      = TEAM_MEMBER_ROLE_ALIASES.get(raw_role)
        branch_id = str(request.data.get('branch_id', '')).strip()

        if not full_name:
            return error_response(message="Full name is required.", status=400)
        if not email or '@' not in email:
            return error_response(message="A valid email is required.", status=400)
        if not password or len(password) < 6:
            return error_response(message="Password must be at least 6 characters.", status=400)
        if not role:
            return error_response(message="Invalid role.", status=400)

        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            _, created = BusinessMember.objects.get_or_create(
                business=business,
                user=user,
                defaults={
                    'role':       role,
                    'status':     'active',
                    'invited_by': request.user,
                }
            )
            if not created:
                return error_response(
                    message=f"{email} is already a member of this business.",
                    status=400,
                )
        else:
            user = User.objects.create(
                full_name   = full_name,
                email       = email,
                password    = make_password(password),
                role        = role,
                is_verified = True,
            )
            BusinessMember.objects.create(
                business    = business,
                user        = user,
                role        = role,
                status      = 'active',
                invited_by  = request.user,
            )

        if not branch_id:
            fallback_branch = Branch.objects.filter(
                business=business
            ).filter(
                Q(branch_type='head_office') | Q(is_primary=True)
            ).first()
            if not fallback_branch:
                fallback_branch = Branch.objects.filter(business=business).order_by('created_at').first()
            
            if fallback_branch:
                branch_id = str(fallback_branch.id)

        branch_name = None
        if branch_id:
            try:
                branch = Branch.objects.get(id=branch_id, business=business)
                branch_member_role = BRANCH_MEMBER_ROLE_BY_USER_ROLE.get(role)
                if branch_member_role:
                    branch_member, _ = BranchMember.objects.get_or_create(
                        branch=branch,
                        user=user,
                        defaults={
                            'role': branch_member_role,
                            'is_active': True,
                            'assigned_by': request.user,
                        },
                    )
                    branch_member.role = branch_member_role
                    branch_member.is_active = True
                    branch_member.assigned_by = request.user
                    branch_member.save(update_fields=['role', 'is_active', 'assigned_by'])

                if role == UserRole.BRANCH_MANAGER and branch.manager_id != user.id:
                    branch.manager = user
                    branch.save(update_fields=['manager'])

                branch_name = branch.name
            except Branch.DoesNotExist:
                pass

        return success_response(
            data={
                'id':              str(user.id),
                'full_name':       user.full_name,
                'email':           user.email,
                'role':            role,
                'branch_assigned': branch_name,
            },
            message=f"Account created for {full_name}. Share {email} and the password with them.",
            status=201,
        )


# ─────────────────────────────────────────────
# REMOVE MEMBER
# ─────────────────────────────────────────────
class BusinessMemberRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, member_id):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        if not is_owner_or_admin(business, request.user):
            return error_response(message="Only the business owner can remove members.", status=403)

        try:
            member = BusinessMember.objects.get(
                id=member_id,
                business=business,
            )
        except BusinessMember.DoesNotExist:
            return error_response(message="Member not found.", status=404)

        if member.user == business.owner:
            return error_response(
                message="Cannot remove the business owner from members."
            )

        member.delete()
        return success_response(message="Member removed successfully.")


# ─────────────────────────────────────────────
# BUSINESS SETTINGS
# ─────────────────────────────────────────────
class BusinessSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        settings, _ = BusinessSettings.objects.get_or_create(business=business)
        return success_response(
            data=BusinessSettingsSerializer(settings).data
        )

    def patch(self, request, pk):
        business, err = get_business_or_error(pk, request.user)
        if err:
            return err

        if not is_owner_or_admin(business, request.user):
            return error_response(message="Only the business owner can update settings.", status=403)

        settings, _ = BusinessSettings.objects.get_or_create(business=business)
        serializer  = UpdateBusinessSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Settings update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(
            data=BusinessSettingsSerializer(settings).data,
            message="Settings updated successfully.",
        )


# ─────────────────────────────────────────────
# MY BUSINESSES — FIXED: returns owned + member businesses
# ─────────────────────────────────────────────
class MyBusinessesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.is_super_admin:
            queryset = Business.objects.all().select_related('owner')
        else:
            # Get ALL businesses where user is owner OR active member
            member_business_ids = BusinessMember.objects.filter(
                user=user,
                status='active',
            ).values_list('business_id', flat=True)

            queryset = Business.objects.filter(
                Q(owner=user) | Q(id__in=member_business_ids)
            ).distinct().select_related('owner')

        serializer = BusinessListSerializer(queryset, many=True)
        return success_response(data=serializer.data)
