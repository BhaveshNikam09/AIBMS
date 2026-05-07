from apps.branches.models import Branch

branches = Branch.objects.filter(is_active=True).values('name', 'branch_type', 'is_primary')
for b in branches:
    print(f"  Name: {b['name']}  |  branch_type: {b['branch_type']}  |  is_primary: {b['is_primary']}")
