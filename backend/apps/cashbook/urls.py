# apps/cashbook/urls.py
# AIBMS – BharatSync AI
# Cashbook URL Patterns

from django.urls import path
from .views import (
    TransactionCategoryListCreateView,
    TransactionCategoryDetailView,
    CashbookEntryListCreateView,
    CashbookEntryDetailView,
    CashbookBalanceView,
    BranchStatsView,
    DailyCashSummaryView,
    BulkCashbookEntryView,
    RecurringTransactionListCreateView,
    RecurringTransactionDetailView,
    MarkAsDoneView,
    PendingDuesView,
)

urlpatterns = [

    # ── Transaction Categories ────────────────
    path(
        '<uuid:business_id>/categories/',
        TransactionCategoryListCreateView.as_view(),
        name='cashbook-categories',
    ),
    path(
        '<uuid:business_id>/categories/<uuid:pk>/',
        TransactionCategoryDetailView.as_view(),
        name='cashbook-category-detail',
    ),

    # ── Cashbook Entries ──────────────────────
    path(
        '<uuid:business_id>/entries/',
        CashbookEntryListCreateView.as_view(),
        name='cashbook-entries',
    ),
    path(
        '<uuid:business_id>/entries/<uuid:pk>/',
        CashbookEntryDetailView.as_view(),
        name='cashbook-entry-detail',
    ),

    # ── Mark Receivable / Payable as Done ─────
    # POST — flips status → confirmed, records settlement date
    path(
        '<uuid:business_id>/entries/<uuid:pk>/mark-done/',
        MarkAsDoneView.as_view(),
        name='cashbook-entry-mark-done',
    ),

    # ── Pending Dues (receivables + payables) ─
    # GET — all PENDING entries in due categories
    path(
        '<uuid:business_id>/entries/pending-dues/',
        PendingDuesView.as_view(),
        name='cashbook-pending-dues',
    ),

    # ── Bulk Entry ────────────────────────────
    path(
        '<uuid:business_id>/entries/bulk/',
        BulkCashbookEntryView.as_view(),
        name='cashbook-bulk-entry',
    ),

    # ── Balance ───────────────────────────────
    path(
        '<uuid:business_id>/balance/',
        CashbookBalanceView.as_view(),
        name='cashbook-balance',
    ),

    # ── Branch-wise Stats ─────────────────────
    path(
        '<uuid:business_id>/stats/branches/',
        BranchStatsView.as_view(),
        name='cashbook-branch-stats',
    ),

    # ── Daily Summary ─────────────────────────
    path(
        '<uuid:business_id>/summary/daily/',
        DailyCashSummaryView.as_view(),
        name='cashbook-daily-summary',
    ),

    # ── Recurring Transactions ────────────────
    path(
        '<uuid:business_id>/recurring/',
        RecurringTransactionListCreateView.as_view(),
        name='cashbook-recurring',
    ),
    path(
        '<uuid:business_id>/recurring/<uuid:pk>/',
        RecurringTransactionDetailView.as_view(),
        name='cashbook-recurring-detail',
    ),
]