# Cashbook models
# apps/cashbook/models.py
# AIBMS – BharatSync AI
# Digital Cashbook Model

import uuid
from django.db import models
from apps.users.models import User
from apps.business.models import Business
from apps.branches.models import Branch


# ─────────────────────────────────────────────
# TRANSACTION TYPE
# ─────────────────────────────────────────────
class TransactionType(models.TextChoices):
    CREDIT = 'credit', 'Credit (Money In)'
    DEBIT  = 'debit',  'Debit (Money Out)'


# ─────────────────────────────────────────────
# PAYMENT MODE
# ─────────────────────────────────────────────
class PaymentMode(models.TextChoices):
    CASH         = 'cash',         'Cash'
    UPI          = 'upi',          'UPI'
    BANK_TRANSFER = 'bank_transfer', 'Bank Transfer'
    CHEQUE       = 'cheque',       'Cheque'
    CARD         = 'card',         'Card'
    OTHER        = 'other',        'Other'


# ─────────────────────────────────────────────
# TRANSACTION CATEGORY
# ─────────────────────────────────────────────
class TransactionCategory(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='transaction_categories',
    )
    name     = models.CharField(max_length=100)
    type     = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
    )
    color    = models.CharField(max_length=7, default='#6366f1')
    icon     = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table        = 'transaction_categories'
        unique_together = ('business', 'name', 'type')
        ordering        = ['name']

    def __str__(self):
        return f"{self.name} ({self.type}) – {self.business.name}"


# ─────────────────────────────────────────────
# CASHBOOK ENTRY
# ─────────────────────────────────────────────
class CashbookEntry(models.Model):

    class EntryStatus(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'

    # ── Identity ──────────────────────────────
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='cashbook_entries',
    )
    branch   = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cashbook_entries',
    )

    # ── Transaction Details ───────────────────
    type         = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        db_index=True,
    )
    amount       = models.DecimalField(max_digits=15, decimal_places=2)
    payment_mode = models.CharField(
        max_length=15,
        choices=PaymentMode.choices,
        default=PaymentMode.CASH,
    )
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='entries',
    )

    # ── Party Details ─────────────────────────
    party_name    = models.CharField(max_length=255, blank=True)
    party_phone   = models.CharField(max_length=15, blank=True)
    party_gstin   = models.CharField(max_length=15, blank=True)

    # ── Description ───────────────────────────
    description  = models.TextField(blank=True)
    reference_no = models.CharField(
        max_length=100,
        blank=True,
        help_text='Invoice/cheque/UTR number',
    )
    tags         = models.JSONField(default=list, blank=True)

    # ── Status ────────────────────────────────
    status = models.CharField(
        max_length=15,
        choices=EntryStatus.choices,
        default=EntryStatus.CONFIRMED,
        db_index=True,
    )

    # ── Date ──────────────────────────────────
    # `date`            = original transaction / expected due date (never modified)
    # `settlement_date` = actual date money moved (set by mark-done for receivable/payable)
    date            = models.DateField(db_index=True)
    settlement_date = models.DateField(
        null=True, blank=True,
        help_text='Actual settlement date — set when a receivable/payable is marked as done.',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='cashbook_entries',
    )

    # ── Attachments ───────────────────────────
    attachment = models.FileField(
        upload_to='cashbook/attachments/',
        null=True, blank=True,
    )

    # ── Timestamps ────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = 'cashbook_entries'
        verbose_name = 'Cashbook Entry'
        verbose_name_plural = 'Cashbook Entries'
        ordering  = ['-date', '-created_at']
        indexes   = [
            models.Index(fields=['business', 'date']),
            models.Index(fields=['business', 'type']),
            models.Index(fields=['business', 'status']),
        ]

    def __str__(self):
        return f"{self.type.upper()} ₹{self.amount} – {self.party_name or 'N/A'} ({self.date})"


# ─────────────────────────────────────────────
# CASHBOOK SUMMARY (Daily snapshot)
# ─────────────────────────────────────────────
class DailyCashSummary(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='daily_summaries',
    )
    branch   = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='daily_summaries',
    )
    date            = models.DateField()
    total_credit    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_debit     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    net_balance     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        db_table        = 'daily_cash_summaries'
        unique_together = ('business', 'branch', 'date')
        ordering        = ['-date']

    def __str__(self):
        return f"Summary {self.date} – {self.business.name} | Net: ₹{self.net_balance}"


# ─────────────────────────────────────────────
# RECURRING TRANSACTION TEMPLATE
# ─────────────────────────────────────────────
class RecurringTransaction(models.Model):

    class Frequency(models.TextChoices):
        DAILY   = 'daily',   'Daily'
        WEEKLY  = 'weekly',  'Weekly'
        MONTHLY = 'monthly', 'Monthly'
        YEARLY  = 'yearly',  'Yearly'

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='recurring_transactions',
    )
    branch   = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='recurring_transactions',
    )
    name         = models.CharField(max_length=255)
    type         = models.CharField(max_length=10, choices=TransactionType.choices)
    amount       = models.DecimalField(max_digits=15, decimal_places=2)
    payment_mode = models.CharField(max_length=15, choices=PaymentMode.choices)
    category     = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    description  = models.TextField(blank=True)
    frequency    = models.CharField(max_length=10, choices=Frequency.choices)
    next_due     = models.DateField()
    is_active    = models.BooleanField(default=True)
    created_by   = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recurring_transactions',
    )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recurring_transactions'
        ordering = ['next_due']

    def __str__(self):
        return f"{self.name} – {self.frequency} ₹{self.amount}"