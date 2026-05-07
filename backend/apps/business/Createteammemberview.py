# ─────────────────────────────────────────────────────────────────────────────
# apps/business/views.py  — ADD this view to your existing business views file
# ─────────────────────────────────────────────────────────────────────────────
#
# Place this class alongside BusinessMemberListView.
# Then add to apps/business/urls.py:
#
#   from .views import CreateTeamMemberView
#   path('<uuid:pk>/members/create/', CreateTeamMemberView.as_view(), name='create-team-member'),
#
# ─────────────────────────────────────────────────────────────────────────────

from rest_framework.views     import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response  import Response
from django.contrib.auth.hashers import make_password
from django.db import transaction

# (these imports already exist in your business views file)
from apps.users.models         import User
from apps.business.models      import Business, BusinessMember
from apps.branches.models      import Branch, BranchMember


class CreateTeamMemberView(APIView):
    """
    Owner creates a new user account and adds them to the business.
    POST /api/v1/business/<pk>/members/create/

    Body:
    {
        "full_name":   "Ravi Kumar",
        "email":       "ravi@example.com",
        "password":    "TempPass@123",
        "role":        "staff",          // staff | manager | accountant
        "branch_id":   "<uuid>"          // optional — assign to a branch
    }
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        # ── Check caller is the business owner ───────────────────────────
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'success': False, 'message': 'Business not found.'}, status=404)

        if business.owner != request.user:
            return Response({'success': False, 'message': 'Only the business owner can create team members.'}, status=403)

        # ── Validate input ────────────────────────────────────────────────
        full_name  = request.data.get('full_name', '').strip()
        email      = request.data.get('email', '').strip().lower()
        password   = request.data.get('password', '').strip()
        role       = request.data.get('role', 'staff').strip().lower()
        branch_id  = request.data.get('branch_id', '').strip()

        if not full_name:
            return Response({'success': False, 'message': 'Full name is required.'}, status=400)
        if not email:
            return Response({'success': False, 'message': 'Email is required.'}, status=400)
        if not password or len(password) < 6:
            return Response({'success': False, 'message': 'Password must be at least 6 characters.'}, status=400)
        if role not in ('staff', 'manager', 'accountant'):
            return Response({'success': False, 'message': 'Role must be staff, manager, or accountant.'}, status=400)

        # ── Check if email already registered ────────────────────────────
        if User.objects.filter(email=email).exists():
            existing_user = User.objects.get(email=email)
            # Just add to business if not already a member
            member, created = BusinessMember.objects.get_or_create(
                business=business,
                user=existing_user,
                defaults={'role': role, 'status': BusinessMember.MemberStatus.ACTIVE}
            )
            if not created:
                return Response({
                    'success': False,
                    'message': f'{email} is already a member of this business.'
                }, status=400)
            user = existing_user
        else:
            # ── Create new user ───────────────────────────────────────────
            user = User.objects.create(
                full_name       = full_name,
                email           = email,
                password        = make_password(password),
                is_email_verified = True,   # owner-created accounts skip email verify
                role            = 'staff',  # base user role
            )
            # Add to business
            BusinessMember.objects.create(
                business = business,
                user     = user,
                role     = role,
                status   = BusinessMember.MemberStatus.ACTIVE,
            )

        # ── Assign to branch if provided ──────────────────────────────────
        branch_assigned = None
        if branch_id:
            try:
                branch = Branch.objects.get(id=branch_id, business=business)
                BranchMember.objects.get_or_create(
                    branch    = branch,
                    user      = user,
                    defaults  = {'is_active': True, 'role': role}
                )
                branch_assigned = branch.name
            except Branch.DoesNotExist:
                pass  # branch not found — still create user, just skip branch assignment

        return Response({
            'success': True,
            'message': f'Account created for {full_name}. They can login with {email} and the password you set.',
            'data': {
                'id':             str(user.id),
                'full_name':      user.full_name,
                'email':          user.email,
                'role':           role,
                'branch_assigned': branch_assigned,
            }
        }, status=201)