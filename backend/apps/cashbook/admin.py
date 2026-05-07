# apps/cashbook/admin.py
# AIBMS – BharatSync AI
# Cashbook Admin Panel Configuration

from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, Q
from decimal import Decimal
from .models import (
    CashbookEntry,
    TransactionCategory,
    DailyCashSummary,
    RecurringTransaction,
    TransactionType,
)


# ─────────────────────────────────────────────
# TRANSACTION CATEGORY ADMIN
# ─────────────────────────────────────────────
@admin.register(TransactionCategory)
class TransactionCategoryAdmin(admin.ModelAdmin):

    list_display  = [
        'name', 'type', 'business',
        'is_active', 'color_preview',
    ]
    list_filter   = ['type', 'is_active']
    search_fields = ['name', 'business__name']
    ordering      = ['name']
    readonly_fields = ['id']

    @admin.display(description='Color')
    def color_preview(self, obj):
        return format_html(
            '<span style="background:{};padding:4px 12px;'
            'border-radius:4px;color:white;font-size:11px;">{}</span>',
            obj.color,
            obj.color,
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY ADMIN
# ─────────────────────────────────────────────
@admin.register(CashbookEntry)
class CashbookEntryAdmin(admin.ModelAdmin):

    list_display = [
        'date', 'business', 'branch',
        'type_badge', 'amount_display',
        'payment_mode', 'party_name',
        'status_badge', 'created_by',
    ]
    list_filter  = [
        'type', 'status', 'payment_mode',
        'date', 'business',
    ]
    search_fields = [
        'party_name', 'party_phone',
        'description', 'reference_no',
        'business__name',
    ]
    ordering      = ['-date', '-created_at']
    readonly_fields = [
        'id', 'created_by', 'created_at', 'updated_at'
    ]
    date_hierarchy = 'date'

    fieldsets = (
        ('Transaction Info', {
            'fields': (
                'id', 'business', 'branch',
                'type', 'amount', 'payment_mode', 'category',
            )
        }),
        ('Party Details', {
            'fields': ('party_name', 'party_phone', 'party_gstin')
        }),
        ('Description', {
            'fields': ('description', 'reference_no', 'tags', 'attachment')
        }),
        ('Status & Date', {
            'fields': ('status', 'date')
        }),
        ('Meta', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Type')
    def type_badge(self, obj):
        if obj.type == TransactionType.CREDIT:
            return format_html(
                '<span style="background:#22c55e;color:white;padding:3px 8px;'
                'border-radius:4px;font-size:11px;">▲ Credit</span>'
            )
        return format_html(
            '<span style="background:#ef4444;color:white;padding:3px 8px;'
            'border-radius:4px;font-size:11px;">▼ Debit</span>'
        )

    @admin.display(description='Amount')
    def amount_display(self, obj):
        color = '#22c55e' if obj.type == TransactionType.CREDIT else '#ef4444'
        return format_html(
            '<span style="color:{};font-weight:bold;">₹{}</span>',
            color,
            f'{obj.amount:,.2f}',
        )

    @admin.display(description='Status')
    def status_badge(self, obj):
        colors = {
            'confirmed': '#22c55e',
            'pending':   '#f59e0b',
            'cancelled': '#6b7280',
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    actions = ['confirm_entries', 'cancel_entries']

    @admin.action(description='Confirm selected entries')
    def confirm_entries(self, request, queryset):
        updated = queryset.exclude(
            status=CashbookEntry.EntryStatus.CANCELLED
        ).update(status=CashbookEntry.EntryStatus.CONFIRMED)
        self.message_user(request, f'{updated} entry(ies) confirmed.')

    @admin.action(description='Cancel selected entries')
    def cancel_entries(self, request, queryset):
        updated = queryset.exclude(
            status=CashbookEntry.EntryStatus.CANCELLED
        ).update(status=CashbookEntry.EntryStatus.CANCELLED)
        self.message_user(request, f'{updated} entry(ies) cancelled.')


# ─────────────────────────────────────────────
# DAILY CASH SUMMARY ADMIN
# ─────────────────────────────────────────────
@admin.register(DailyCashSummary)
class DailyCashSummaryAdmin(admin.ModelAdmin):

    list_display = [
        'date', 'business', 'branch',
        'opening_balance_display',
        'total_credit_display',
        'total_debit_display',
        'closing_balance_display',
    ]
    list_filter   = ['date', 'business']
    search_fields = ['business__name', 'branch__name']
    ordering      = ['-date']
    readonly_fields = ['id']
    date_hierarchy  = 'date'

    def has_add_permission(self, request):
        return False

    @admin.display(description='Opening')
    def opening_balance_display(self, obj):
        return format_html(
            '<span style="color:#6366f1;">₹{}</span>',
            f'{obj.opening_balance:,.2f}',
        )

    @admin.display(description='Credit')
    def total_credit_display(self, obj):
        return format_html(
            '<span style="color:#22c55e;font-weight:bold;">₹{}</span>',
            f'{obj.total_credit:,.2f}',
        )

    @admin.display(description='Debit')
    def total_debit_display(self, obj):
        return format_html(
            '<span style="color:#ef4444;font-weight:bold;">₹{}</span>',
            f'{obj.total_debit:,.2f}',
        )

    @admin.display(description='Closing')
    def closing_balance_display(self, obj):
        color = '#22c55e' if obj.closing_balance >= 0 else '#ef4444'
        return format_html(
            '<span style="color:{};font-weight:bold;">₹{}</span>',
            color,
            f'{obj.closing_balance:,.2f}',
        )


# ─────────────────────────────────────────────
# RECURRING TRANSACTION ADMIN
# ─────────────────────────────────────────────
@admin.register(RecurringTransaction)
class RecurringTransactionAdmin(admin.ModelAdmin):

    list_display = [
        'name', 'business', 'type_badge',
        'amount_display', 'frequency',
        'next_due', 'is_active',
    ]
    list_filter   = ['type', 'frequency', 'is_active']
    search_fields = ['name', 'business__name']
    ordering      = ['next_due']
    readonly_fields = ['id', 'created_at']

    @admin.display(description='Type')
    def type_badge(self, obj):
        if obj.type == TransactionType.CREDIT:
            return format_html(
                '<span style="color:#22c55e;font-weight:bold;">▲ Credit</span>'
            )
        return format_html(
            '<span style="color:#ef4444;font-weight:bold;">▼ Debit</span>'
        )

    @admin.display(description='Amount')
    def amount_display(self, obj):
        color = '#22c55e' if obj.type == TransactionType.CREDIT else '#ef4444'
        return format_html(
            '<span style="color:{};font-weight:bold;">₹{}</span>',
            color,
            f'{obj.amount:,.2f}',
        )

    actions = ['activate_recurring', 'deactivate_recurring']

    @admin.action(description='Activate selected recurring transactions')
    def activate_recurring(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} transaction(s) activated.')

    @admin.action(description='Deactivate selected recurring transactions')
    def deactivate_recurring(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} transaction(s) deactivated.')