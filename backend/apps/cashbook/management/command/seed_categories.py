# apps/cashbook/management/commands/seed_categories.py
# Run with: python manage.py seed_categories
#
# Place this file at:
# apps/cashbook/management/__init__.py       (empty file)
# apps/cashbook/management/commands/__init__.py  (empty file)
# apps/cashbook/management/commands/seed_categories.py  (this file)

from django.core.management.base import BaseCommand
from apps.cashbook.models import TransactionCategory


INCOME_CATEGORIES = [
    ('Sales',             'credit', '#22c55e', '💰'),
    ('Service Income',    'credit', '#16a34a', '🛠️'),
    ('Commission',        'credit', '#15803d', '🤝'),
    ('Receivable',        'credit', '#4ade80', '📥'),
    ('Loan Received',     'credit', '#86efac', '🏦'),
    ('Investment',        'credit', '#bbf7d0', '📈'),
    ('Interest Income',   'credit', '#6ee7b7', '💹'),
    ('Refund Received',   'credit', '#34d399', '↩️'),
    ('Other Income',      'credit', '#a7f3d0', '➕'),
]

EXPENSE_CATEGORIES = [
    ('Rent',              'debit', '#ef4444', '🏠'),
    ('Salaries',          'debit', '#dc2626', '👥'),
    ('Utilities',         'debit', '#b91c1c', '💡'),
    ('Raw Materials',     'debit', '#f87171', '🏭'),
    ('Transport',         'debit', '#fca5a5', '🚚'),
    ('Marketing',         'debit', '#fb923c', '📣'),
    ('GST Payment',       'debit', '#f97316', '🧾'),
    ('TDS Payment',       'debit', '#ea580c', '📋'),
    ('Payable',           'debit', '#fbbf24', '📤'),
    ('Loan Repayment',    'debit', '#f59e0b', '🏦'),
    ('Office Supplies',   'debit', '#d97706', '📎'),
    ('Insurance',         'debit', '#92400e', '🛡️'),
    ('Professional Fees', 'debit', '#78350f', '👔'),
    ('Other Expense',     'debit', '#fde68a', '➖'),
]


class Command(BaseCommand):
    help = 'Seed default TransactionCategory entries for income and expense'

    def handle(self, *args, **options):
        created = 0
        skipped = 0

        all_cats = INCOME_CATEGORIES + EXPENSE_CATEGORIES

        for name, cat_type, color, icon in all_cats:
            obj, was_created = TransactionCategory.objects.get_or_create(
                name=name,
                type=cat_type,
                defaults={
                    'color':     color,
                    'icon':      icon,
                    'is_active': True,
                }
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'  ✅ Created: {name} ({cat_type})'))
            else:
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone! Created {created} categories, skipped {skipped} existing.'
            )
        )