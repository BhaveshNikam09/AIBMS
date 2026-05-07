# Branches views
# apps/branches/views.py
# AIBMS –AIBMS
# Branch Views

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from utils.response import success_response, error_response
from utils.pagination import StandardPagination
from apps.business.models import Business, BusinessMember

from .models import Branch, BranchMember, BranchOperatingHours
from .serializers import (
    BranchCreateSerializer,
    BranchListSerializer,
    BranchDetailSerializer,
    BranchUpdateSerializer,
    BranchMemberSerializer,
    AddBranchMemberSerializer,
    BranchOperatingHoursSerializer,
    BulkOperatingHoursSerializer,
)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_business_or_error(business_id, user):
    try:
        business = Business.objects.get(pk=business_id)
    except Business.DoesNotExist:
        return None, error_response(message="Business not found.", status=404)

    if not (
        user.is_super_admin or
        business.owner == user or
        BusinessMember.objects.filter(
            business=business,
            user=user,
            status=BusinessMember.MemberStatus.ACTIVE,
        ).exists()
    ):
        return None, error_response(message="Permission denied.", status=403)

    return business, None


def get_branch_or_error(branch_id, user):
    try:
        branch = Branch.objects.select_related('business', 'manager').get(pk=branch_id)
    except Branch.DoesNotExist:
        return None, error_response(message="Branch not found.", status=404)

    business = branch.business

    if not (
        user.is_super_admin or
        business.owner == user or
        BranchMember.objects.filter(
            branch=branch,
            user=user,
            is_active=True,
        ).exists()
    ):
        return None, error_response(message="Permission denied.", status=403)

    return branch, None


def can_manage_branch(branch, user):
    """Modified to allow any business member to manage branches (per user request)."""
    return (
        user.is_super_admin or
        branch.business.owner == user or
        BusinessMember.objects.filter(business=branch.business, user=user, status='active').exists()
    )


# ─────────────────────────────────────────────
# BRANCH LIST & CREATE
# ─────────────────────────────────────────────
class BranchListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = Branch.objects.filter(
            business=business
        ).select_related('manager')

        # Filters
        is_active   = request.query_params.get('is_active')
        branch_type = request.query_params.get('branch_type')
        search      = request.query_params.get('search')

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if branch_type:
            queryset = queryset.filter(branch_type=branch_type)
        if search:
            queryset = queryset.filter(name__icontains=search)

        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = BranchListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        # Only owner or super admin can create branches
        if not (request.user.is_super_admin or business.owner == request.user):
            return error_response(
                message="Only the business owner can create branches.",
                status=403,
            )

        serializer = BranchCreateSerializer(
            data=request.data,
            context={
                'request':  request,
                'business': business,
            },
        )
        if not serializer.is_valid():
            return error_response(
                message="Branch creation failed.",
                errors=serializer.errors,
            )

        branch = serializer.save()
        return success_response(
            data=BranchDetailSerializer(branch).data,
            message="Branch created successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# BRANCH DETAIL, UPDATE, DELETE
# ─────────────────────────────────────────────
class BranchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        return success_response(
            data=BranchDetailSerializer(branch).data
        )

    def patch(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        if not can_manage_branch(branch, request.user):
            return error_response(
                message="You do not have permission to update this branch.",
                status=403,
            )

        serializer = BranchUpdateSerializer(
            branch,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Branch update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(
            data=BranchDetailSerializer(branch).data,
            message="Branch updated successfully.",
        )

    def delete(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        if not can_manage_branch(branch, request.user):
            return error_response(
                message="You do not have permission to delete this branch.",
                status=403,
            )

        # Soft delete
        branch.is_active = False
        branch.save(update_fields=['is_active'])
        return success_response(message="Branch deactivated successfully.")


# ─────────────────────────────────────────────
# BRANCH MEMBERS
# ─────────────────────────────────────────────
class BranchMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        members = BranchMember.objects.filter(
            branch=branch
        ).select_related('user', 'assigned_by')

        serializer = BranchMemberSerializer(members, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        if not can_manage_branch(branch, request.user):
            return error_response(
                message="You do not have permission to add members.",
                status=403,
            )

        serializer = AddBranchMemberSerializer(
            data=request.data,
            context={
                'request': request,
                'branch':  branch,
            },
        )
        if not serializer.is_valid():
            return error_response(
                message="Failed to add member.",
                errors=serializer.errors,
            )

        member = serializer.save()
        return success_response(
            data=BranchMemberSerializer(member).data,
            message="Member added to branch successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# REMOVE BRANCH MEMBER
# ─────────────────────────────────────────────
class BranchMemberRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, business_id, branch_id, member_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        if not can_manage_branch(branch, request.user):
            return error_response(
                message="You do not have permission to remove members.",
                status=403,
            )

        try:
            member = BranchMember.objects.get(id=member_id, branch=branch)
        except BranchMember.DoesNotExist:
            return error_response(message="Member not found.", status=404)

        # Prevent removing the branch manager
        if branch.manager and member.user == branch.manager:
            return error_response(
                message="Cannot remove the branch manager. Reassign manager first."
            )

        member.delete()
        return success_response(message="Member removed from branch successfully.")


# ─────────────────────────────────────────────
# OPERATING HOURS
# ─────────────────────────────────────────────
class BranchOperatingHoursView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        hours = BranchOperatingHours.objects.filter(
            branch=branch
        ).order_by('day')

        serializer = BranchOperatingHoursSerializer(hours, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id, branch_id):
        branch, err = get_branch_or_error(branch_id, request.user)
        if err:
            return err

        if not can_manage_branch(branch, request.user):
            return error_response(
                message="You do not have permission to set operating hours.",
                status=403,
            )

        serializer = BulkOperatingHoursSerializer(
            data=request.data,
            context={'branch': branch},
        )
        if not serializer.is_valid():
            return error_response(
                message="Failed to set operating hours.",
                errors=serializer.errors,
            )

        hours = serializer.save()
        return success_response(
            data=BranchOperatingHoursSerializer(hours, many=True).data,
            message="Operating hours updated successfully.",
        )


# ─────────────────────────────────────────────
# ALL BRANCHES (across all businesses for user)
# ─────────────────────────────────────────────
class MyBranchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.is_super_admin:
            queryset = Branch.objects.all().select_related('business', 'manager')
        elif user.is_business_owner:
            queryset = Branch.objects.filter(
                business__owner=user
            ).select_related('business', 'manager')
        else:
            branch_ids = BranchMember.objects.filter(
                user=user,
                is_active=True,
            ).values_list('branch_id', flat=True)
            queryset = Branch.objects.filter(
                id__in=branch_ids
            ).select_related('business', 'manager')

        serializer = BranchListSerializer(queryset, many=True)
        return success_response(data=serializer.data)