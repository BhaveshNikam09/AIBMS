# Cashbook serializers
# apps/cashbook/serializers.py
# AIBMS – BharatSync AI
# Cashbook Serializers

import re
from datetime import date as date_type
from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers

from apps.business.models import Business
from apps.branches.models import Branch
from .models import (
    CashbookEntry,
    TransactionCategory,
    DailyCashSummary,
    RecurringTransaction,
    TransactionType,
    PaymentMode,
)

# Category names that require a FUTURE date and start as PENDING
DUE_CATEGORY_NAMES = {'receivable', 'payable'}


def _is_due_category(category):
    return (
        category is not None
        and category.name.strip().lower() in DUE_CATEGORY_NAMES
    )


# ─────────────────────────────────────────────
# SHARED DATE VALIDATION HELPER
# ─────────────────────────────────────────────
def validate_entry_date(entry_date, category, status=None, due_date=None):
    """
    Business rules:
      • Receivable/Payable (due categories) : date must be strictly > today in IST.
      • Pending entries (any category)      : future dates allowed — they represent
                                              scheduled / planned transactions.
      • Regular confirmed/cancelled entries : date must be <= today in IST.

    We derive "today" from the IST timezone so that users submitting entries
    just after midnight IST (when UTC is still the previous day) are never
    incorrectly blocked.
    """
    from datetime import timezone, timedelta, datetime as dt

    # IST = UTC + 5:30
    IST   = timezone(timedelta(hours=5, minutes=30))
    today = dt.now(IST).date()    # today's date in IST

    is_due_cat = _is_due_category(category)

    if is_due_cat:
        # Receivable / Payable must always be a future date
        if entry_date <= today:
            raise serializers.ValidationError(
                f"'{category.name}' entries require a future date. "
                f"Please pick tomorrow or later."
            )
    elif status == CashbookEntry.EntryStatus.PENDING:
        # Pending (scheduled) entries are allowed to have any date —
        # past, today, or future — since they haven't settled yet.
        pass
    else:
        # Confirmed / cancelled regular entries must not be future-dated
        if entry_date > today:
            raise serializers.ValidationError(
                "Transaction date cannot be in the future. "
                "Only today or past dates are allowed for regular entries."
            )


# ─────────────────────────────────────────────
# TRANSACTION CATEGORY SERIALIZER
# ─────────────────────────────────────────────
class TransactionCategorySerializer(serializers.ModelSerializer):

    class Meta:
        model  = TransactionCategory
        fields = [
            'id', 'name', 'type',
            'color', 'icon', 'is_active',
        ]
        read_only_fields = ['id']

    def validate_color(self, value):
        if value and not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError(
                "Color must be a valid hex code (e.g. #6366f1)."
            )
        return value

    def validate(self, attrs):
        business = self.context.get('business')
        name     = attrs.get('name')
        type_    = attrs.get('type')

        qs = TransactionCategory.objects.filter(
            business=business,
            name=name,
            type=type_,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"name": f"A '{type_}' category with this name already exists."}
            )
        return attrs

    def create(self, validated_data):
        business = self.context['business']
        return TransactionCategory.objects.create(
            business=business,
            **validated_data,
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY CREATE SERIALIZER
# ─────────────────────────────────────────────
class CashbookEntryCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = CashbookEntry
        fields = [
            'type', 'amount', 'payment_mode',
            'category', 'branch',
            'party_name', 'party_phone', 'party_gstin',
            'description', 'reference_no', 'tags',
            'status', 'date', 'attachment',
        ]
        extra_kwargs = {
            'category':    {'required': False},
            'branch':      {'required': False},
            'tags':        {'required': False},
            'attachment':  {'required': False},
            'status':      {'required': False},
        }

    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError(
                "Amount must be greater than zero."
            )
        return value

    def validate_category(self, value):
        if value:
            business = self.context.get('business')
            if value.business != business:
                raise serializers.ValidationError(
                    "Category does not belong to this business."
                )
        return value

    def validate_branch(self, value):
        if value:
            business = self.context.get('business')
            if value.business != business:
                raise serializers.ValidationError(
                    "Branch does not belong to this business."
                )
        return value

    def validate_party_gstin(self, value):
        if value:
            pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
            if not re.match(pattern, value.upper()):
                raise serializers.ValidationError("Invalid GSTIN format.")
        return value.upper() if value else value

    def validate(self, attrs):
        entry_date = attrs.get('date')
        category   = attrs.get('category')
        # Determine effective status: due categories are always forced to PENDING
        status = (
            CashbookEntry.EntryStatus.PENDING
            if _is_due_category(category)
            else attrs.get('status', CashbookEntry.EntryStatus.CONFIRMED)
        )
        if entry_date:
            validate_entry_date(entry_date, category, status=status)

        # ── Auto-set status for due categories ────────────────────────────────
        # Receivable / Payable entries start as PENDING regardless of what the
        # caller sends.  They must be explicitly marked done via /mark-done/.
        if _is_due_category(category):
            attrs['status'] = CashbookEntry.EntryStatus.PENDING

        return attrs

    def create(self, validated_data):
        business   = self.context['business']
        created_by = self.context['request'].user
        return CashbookEntry.objects.create(
            business=business,
            created_by=created_by,
            **validated_data,
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY LIST SERIALIZER (lightweight)
# Includes category_id, branch_id, and is_due_pending
# so the frontend can show Mark-as-Done buttons.
# ─────────────────────────────────────────────
class CashbookEntryListSerializer(serializers.ModelSerializer):

    category_name = serializers.CharField(
        source='category.name', read_only=True
    )
    category_id = serializers.UUIDField(
        source='category.id', read_only=True, allow_null=True
    )
    branch_name = serializers.CharField(
        source='branch.name', read_only=True
    )
    branch_id = serializers.UUIDField(
        source='branch.id', read_only=True, allow_null=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    # True when this entry is a pending receivable or payable.
    # The frontend uses this to decide whether to show the Mark-as-Done CTA.
    is_due_pending = serializers.SerializerMethodField()

    class Meta:
        model  = CashbookEntry
        fields = [
            'id', 'type', 'amount', 'payment_mode',
            'category_name', 'category_id',
            'branch_name',   'branch_id',
            'party_name', 'party_phone',
            'description', 'reference_no', 'tags',
            'status', 'date', 'is_due_pending',
            'created_by_name', 'created_at', 'updated_at',
        ]

    def get_is_due_pending(self, obj):
        return (
            obj.status == CashbookEntry.EntryStatus.PENDING
            and _is_due_category(obj.category)
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY DETAIL SERIALIZER (full)
# ─────────────────────────────────────────────
class CashbookEntryDetailSerializer(serializers.ModelSerializer):

    category        = TransactionCategorySerializer(read_only=True)
    branch_name     = serializers.CharField(source='branch.name',          read_only=True)
    branch_id       = serializers.UUIDField(source='branch.id',            read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    is_due_pending  = serializers.SerializerMethodField()

    class Meta:
        model  = CashbookEntry
        fields = [
            'id', 'type', 'amount', 'payment_mode',
            'category', 'branch_name', 'branch_id',
            'party_name', 'party_phone', 'party_gstin',
            'description', 'reference_no', 'tags',
            'status', 'date', 'attachment', 'is_due_pending',
            'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'created_by_name', 'created_at', 'updated_at', 'is_due_pending'
        ]

    def get_is_due_pending(self, obj):
        return (
            obj.status == CashbookEntry.EntryStatus.PENDING
            and _is_due_category(obj.category)
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY UPDATE SERIALIZER
# ─────────────────────────────────────────────
class CashbookEntryUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = CashbookEntry
        fields = [
            'amount', 'payment_mode', 'category',
            'party_name', 'party_phone', 'party_gstin',
            'description', 'reference_no', 'tags',
            'status', 'date', 'attachment',
        ]

    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError(
                "Amount must be greater than zero."
            )
        return value

    def validate(self, attrs):
        if self.instance.status == CashbookEntry.EntryStatus.CANCELLED:
            raise serializers.ValidationError("Cannot edit a cancelled entry.")

        entry_date = attrs.get('date', self.instance.date)
        category   = attrs.get('category', self.instance.category)

        # Prevent manually promoting a due entry to confirmed via plain PATCH.
        # Use /mark-done/ instead — it records the settlement date properly.
        incoming_status = attrs.get('status')
        if (
            incoming_status == CashbookEntry.EntryStatus.CONFIRMED
            and self.instance.status == CashbookEntry.EntryStatus.PENDING
            and _is_due_category(category)
        ):
            raise serializers.ValidationError(
                "Use the Mark-as-Done action to confirm a Receivable or Payable entry."
            )

        if entry_date:
            # Skip future-date check when settling a due entry (date is being
            # set to today by MarkAsDoneView — validated there already).
            if not _is_due_category(category):
                effective_status = incoming_status or self.instance.status
                validate_entry_date(entry_date, category, status=effective_status)

        return attrs


# ─────────────────────────────────────────────
# DAILY CASH SUMMARY SERIALIZER
# ─────────────────────────────────────────────
class DailyCashSummarySerializer(serializers.ModelSerializer):

    branch_name = serializers.CharField(
        source='branch.name', read_only=True
    )

    class Meta:
        model  = DailyCashSummary
        fields = [
            'id', 'date', 'branch_name',
            'opening_balance', 'total_credit',
            'total_debit', 'net_balance', 'closing_balance',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# CASHBOOK BALANCE SERIALIZER
# ─────────────────────────────────────────────
class CashbookBalanceSerializer(serializers.Serializer):

    total_credit  = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debit   = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_balance   = serializers.DecimalField(max_digits=15, decimal_places=2)
    entry_count   = serializers.IntegerField()
    date_from     = serializers.DateField(allow_null=True)
    date_to       = serializers.DateField(allow_null=True)


# ─────────────────────────────────────────────
# RECURRING TRANSACTION SERIALIZER
# ─────────────────────────────────────────────
class RecurringTransactionSerializer(serializers.ModelSerializer):

    category_name = serializers.CharField(
        source='category.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = RecurringTransaction
        fields = [
            'id', 'name', 'type', 'amount',
            'payment_mode', 'category', 'category_name',
            'description', 'frequency', 'next_due',
            'is_active', 'branch',
            'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at']

    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError(
                "Amount must be greater than zero."
            )
        return value

    def create(self, validated_data):
        business   = self.context['business']
        created_by = self.context['request'].user
        return RecurringTransaction.objects.create(
            business=business,
            created_by=created_by,
            **validated_data,
        )


# ─────────────────────────────────────────────
# BULK ENTRY SERIALIZER
# ─────────────────────────────────────────────
class BulkCashbookEntrySerializer(serializers.Serializer):

    entries = CashbookEntryCreateSerializer(many=True)

    def validate_entries(self, value):
        if len(value) == 0:
            raise serializers.ValidationError(
                "At least one entry is required."
            )
        if len(value) > 100:
            raise serializers.ValidationError(
                "Cannot create more than 100 entries at once."
            )
        return value

    def create(self, validated_data):
        business   = self.context['business']
        created_by = self.context['request'].user
        entries    = []

        for entry_data in validated_data['entries']:
            entries.append(CashbookEntry(
                business=business,
                created_by=created_by,
                **entry_data,
            ))

        return CashbookEntry.objects.bulk_create(entries)