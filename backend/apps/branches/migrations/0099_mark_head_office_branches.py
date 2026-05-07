from django.db import migrations


def mark_ho_branches(apps, schema_editor):
    """
    For each business, mark the correct branch as head_office + is_primary.
    Priority:
      1. Any branch already typed as head_office -> keep it, mark is_primary
      2. Any branch with is_primary=True -> set branch_type to head_office
      3. First branch by name starting with HO / Head / Main / HQ
      4. Oldest branch (first created) -> mark as head_office
    """
    Branch = apps.get_model('branches', 'Branch')

    business_ids = Branch.objects.filter(is_active=True).values_list('business_id', flat=True).distinct()

    for biz_id in business_ids:
        active = Branch.objects.filter(business_id=biz_id, is_active=True)

        # Step 1 — already typed as HO?
        ho = active.filter(branch_type='head_office').first()
        if ho:
            if not ho.is_primary:
                ho.is_primary = True
                ho.save(update_fields=['is_primary'])
            continue

        # Step 2 — already marked primary?
        primary = active.filter(is_primary=True).first()
        if primary:
            primary.branch_type = 'head_office'
            primary.save(update_fields=['branch_type'])
            continue

        # Step 3 — name keywords
        for kw in ['head office', 'head_office', 'hq', 'main', 'headquarter']:
            b = active.filter(name__icontains=kw).first()
            if b:
                b.branch_type = 'head_office'
                b.is_primary = True
                b.save(update_fields=['branch_type', 'is_primary'])
                break
        else:
            # Step 4 — oldest branch
            oldest = active.order_by('created_at').first()
            if oldest:
                oldest.branch_type = 'head_office'
                oldest.is_primary = True
                oldest.save(update_fields=['branch_type', 'is_primary'])


def reverse_migration(apps, schema_editor):
    pass  # irreversible data migration


class Migration(migrations.Migration):

    dependencies = [
        ('branches', '0002_branch_locality_alter_branch_city_and_more'),
    ]

    operations = [
        migrations.RunPython(mark_ho_branches, reverse_migration),
    ]
