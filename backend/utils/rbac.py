from django.db.models import Q


ROLE_ALIASES = {
    'business_owner': 'owner',
    'super_admin': 'owner',
    'branch_manager': 'manager',
    'ca': 'accountant',
}


def normalize_role(role):
    raw = str(role or '').strip().lower()
    return ROLE_ALIASES.get(raw, raw)


def is_business_owner(business_id, user):
    if not user:
        return False
    if getattr(user, 'is_super_admin', False):
        return True

    try:
        from apps.business.models import Business
        return Business.objects.filter(id=business_id, owner=user).exists()
    except Exception:
        return False


def get_business_role_for_business(business_id, user):
    if not user:
        return ''

    if is_business_owner(business_id, user):
        return 'owner'

    try:
        from apps.business.models import BusinessMember
        membership = BusinessMember.objects.filter(
            business_id=business_id,
            user=user,
            status=BusinessMember.MemberStatus.ACTIVE,
        ).first()
        if membership:
            return normalize_role(membership.role)
    except Exception:
        pass

    return normalize_role(getattr(user, 'role', ''))


def get_scoped_branch_ids(business_id, user):
    role = get_business_role_for_business(business_id, user)
    if role in {'owner', 'accountant'}:
        return None
    if role not in {'manager', 'staff'}:
        return None

    try:
        from apps.branches.models import BranchMember
        branch_ids = BranchMember.objects.filter(
            branch__business_id=business_id,
            user=user,
            is_active=True,
        ).values_list('branch_id', flat=True).distinct()
        return [str(branch_id) for branch_id in branch_ids]
    except Exception:
        return []


def scope_branch_queryset(queryset, business_id, user, branch_field='branch_id', include_unassigned=False):
    branch_ids = get_scoped_branch_ids(business_id, user)
    if branch_ids is None:
        return queryset
    if not branch_ids:
        return queryset.none()

    lookup = {f'{branch_field}__in': branch_ids}
    if include_unassigned:
        return queryset.filter(Q(**lookup) | Q(**{f'{branch_field}__isnull': True}))
    return queryset.filter(**lookup)


def get_branch_scope_label(business_id, user):
    branch_ids = get_scoped_branch_ids(business_id, user)
    if branch_ids is None:
        return 'All Branches'
    if not branch_ids:
        return 'No Branches'

    try:
        from apps.branches.models import Branch
        names = list(
            Branch.objects.filter(
                business_id=business_id,
                id__in=branch_ids,
                is_active=True,
            ).values_list('name', flat=True)
        )
    except Exception:
        names = []

    if len(names) == 1:
        return names[0] or 'Branch'
    return 'Assigned Branches'
