# Cashbook views
# apps/cashbook/views.py
# AIBMS – BharatSync AI
# Cashbook Views

from decimal import Decimal
from django.db.models import Sum, Count, Q
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from utils.response import success_response, error_response
from utils.pagination import StandardPagination
from apps.business.models import Business, BusinessMember
from apps.branches.models import Branch

from .models import (
    CashbookEntry,
    TransactionCategory,
    DailyCashSummary,
    RecurringTransaction,
    TransactionType,
)
from .serializers import (
    CashbookEntryCreateSerializer,
    CashbookEntryListSerializer,
    CashbookEntryDetailSerializer,
    CashbookEntryUpdateSerializer,
    TransactionCategorySerializer,
    DailyCashSummarySerializer,
    CashbookBalanceSerializer,
    RecurringTransactionSerializer,
    BulkCashbookEntrySerializer,
)

# Category names treated as "due" (receivable / payable)
DUE_CATEGORY_NAMES = {'receivable', 'payable'}


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_business_or_error(business_id, user):
    try:
        business = Business.objects.get(pk=business_id)
    except Business.DoesNotExist:
        return None, error_response(message="Business not found.", status=404)

    is_member = BusinessMember.objects.filter(
        business=business,
        user=user,
        status=BusinessMember.MemberStatus.ACTIVE,
    ).exists()

    if not (user.is_super_admin or business.owner == user or is_member):
        return None, error_response(message="Permission denied.", status=403)

    return business, None


def can_manage_cashbook(business, user):
    """Owner, super admin, accountant can manage cashbook entries."""
    if user.is_super_admin or business.owner == user:
        return True
    return BusinessMember.objects.filter(
        business=business,
        user=user,
        status=BusinessMember.MemberStatus.ACTIVE,
    ).exists()


def compute_balance(queryset):
    """Compute credit, debit and net balance from a queryset.
    Only CONFIRMED entries count — pending receivables/payables are excluded.
    """
    result = queryset.filter(
        status=CashbookEntry.EntryStatus.CONFIRMED
    ).aggregate(
        total_credit=Sum(
            'amount', filter=Q(type=TransactionType.CREDIT)
        ),
        total_debit=Sum(
            'amount', filter=Q(type=TransactionType.DEBIT)
        ),
        entry_count=Count('id'),
    )
    credit  = result['total_credit']  or Decimal('0')
    debit   = result['total_debit']   or Decimal('0')
    count   = result['entry_count']   or 0
    return credit, debit, credit - debit, count


def _is_due_entry(entry):
    """Return True if the entry belongs to a receivable/payable category."""
    if entry.category and entry.category.name.strip().lower() in DUE_CATEGORY_NAMES:
        return True
    return False


# ─────────────────────────────────────────────
# TRANSACTION CATEGORIES
# ─────────────────────────────────────────────
class TransactionCategoryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = TransactionCategory.objects.filter(business=business)

        type_filter = request.query_params.get('type')
        if type_filter:
            queryset = queryset.filter(type=type_filter)

        serializer = TransactionCategorySerializer(queryset, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        serializer = TransactionCategorySerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Category creation failed.",
                errors=serializer.errors,
            )

        category = serializer.save()
        return success_response(
            data=TransactionCategorySerializer(category).data,
            message="Category created successfully.",
            status=201,
        )


class TransactionCategoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, business, pk):
        try:
            return TransactionCategory.objects.get(pk=pk, business=business)
        except TransactionCategory.DoesNotExist:
            return None

    def patch(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        category = self.get_object(business, pk)
        if not category:
            return error_response(message="Category not found.", status=404)

        serializer = TransactionCategorySerializer(
            category,
            data=request.data,
            partial=True,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(errors=serializer.errors)

        serializer.save()
        return success_response(
            data=serializer.data,
            message="Category updated successfully.",
        )

    def delete(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        category = self.get_object(business, pk)
        if not category:
            return error_response(message="Category not found.", status=404)

        category.is_active = False
        category.save(update_fields=['is_active'])
        return success_response(message="Category deactivated successfully.")


# ─────────────────────────────────────────────
# CASHBOOK ENTRIES – LIST & CREATE
# ─────────────────────────────────────────────
class CashbookEntryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = CashbookEntry.objects.filter(
            business=business
        ).select_related('category', 'branch', 'created_by')

        # ── Filters ───────────────────────────
        type_filter    = request.query_params.get('type')
        status_filter  = request.query_params.get('status')
        payment_mode   = request.query_params.get('payment_mode')
        branch_id      = request.query_params.get('branch')
        category_id    = request.query_params.get('category')
        date_from      = request.query_params.get('date_from')
        date_to        = request.query_params.get('date_to')
        search         = request.query_params.get('search')
        min_amount     = request.query_params.get('min_amount')
        max_amount     = request.query_params.get('max_amount')

        if type_filter:
            queryset = queryset.filter(type=type_filter)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if payment_mode:
            queryset = queryset.filter(payment_mode=payment_mode)
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if date_from:
            queryset = queryset.filter(date__gte=parse_date(date_from))
        if date_to:
            queryset = queryset.filter(date__lte=parse_date(date_to))
        if search:
            queryset = queryset.filter(
                Q(party_name__icontains=search)  |
                Q(description__icontains=search) |
                Q(reference_no__icontains=search)
            )
        if min_amount:
            queryset = queryset.filter(amount__gte=Decimal(min_amount))
        if max_amount:
            queryset = queryset.filter(amount__lte=Decimal(max_amount))

        # ── Pagination ────────────────────────
        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = CashbookEntryListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not can_manage_cashbook(business, request.user):
            return error_response(message="Permission denied.", status=403)

        serializer = CashbookEntryCreateSerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            import logging
            logger = logging.getLogger(__name__)
            logger.error("CashbookEntry creation errors: %s | Data: %s", serializer.errors, request.data)
            return error_response(
                message="Entry creation failed.",
                errors=serializer.errors,
            )

        entry = serializer.save()
        return success_response(
            data=CashbookEntryDetailSerializer(entry).data,
            message="Entry created successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# CASHBOOK ENTRY – DETAIL, UPDATE, DELETE
# ─────────────────────────────────────────────
class CashbookEntryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, business, pk):
        try:
            return CashbookEntry.objects.select_related(
                'category', 'branch', 'created_by'
            ).get(pk=pk, business=business)
        except CashbookEntry.DoesNotExist:
            return None

    def get(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        entry = self.get_object(business, pk)
        if not entry:
            return error_response(message="Entry not found.", status=404)

        return success_response(
            data=CashbookEntryDetailSerializer(entry).data
        )

    def patch(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not can_manage_cashbook(business, request.user):
            return error_response(message="Permission denied.", status=403)

        entry = self.get_object(business, pk)
        if not entry:
            return error_response(message="Entry not found.", status=404)

        serializer = CashbookEntryUpdateSerializer(
            entry,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(
            data=CashbookEntryDetailSerializer(entry).data,
            message="Entry updated successfully.",
        )

    def delete(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not can_manage_cashbook(business, request.user):
            return error_response(message="Permission denied.", status=403)

        entry = self.get_object(business, pk)
        if not entry:
            return error_response(message="Entry not found.", status=404)

        # Soft delete — cancel the entry
        entry.status = CashbookEntry.EntryStatus.CANCELLED
        entry.save(update_fields=['status'])
        return success_response(message="Entry cancelled successfully.")


# ─────────────────────────────────────────────
# MARK AS DONE — receivable / payable entries
# POST /<business_id>/entries/<pk>/mark-done/
#
# Rules:
#   • Entry must belong to a receivable or payable category.
#   • Entry must currently be PENDING.
#   • On success: status → CONFIRMED, date → today (payment actually received).
#   • Amount is then counted in compute_balance going forward.
# ─────────────────────────────────────────────
class MarkAsDoneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not can_manage_cashbook(business, request.user):
            return error_response(message="Permission denied.", status=403)

        try:
            entry = CashbookEntry.objects.select_related('category').get(
                pk=pk, business=business
            )
        except CashbookEntry.DoesNotExist:
            return error_response(message="Entry not found.", status=404)

        # Guard: must still be pending
        if entry.status == CashbookEntry.EntryStatus.CONFIRMED:
            return error_response(
                message="This entry is already marked as done.",
                status=400,
            )
        if entry.status == CashbookEntry.EntryStatus.CANCELLED:
            return error_response(
                message="Cancelled entries cannot be marked as done.",
                status=400,
            )

        from datetime import date as date_type
        # Allow caller to supply a settlement date (defaults to today)
        settlement_date_str = request.data.get('settlement_date')
        if settlement_date_str:
            settlement_date = parse_date(settlement_date_str)
            if not settlement_date:
                return error_response(
                    message="Invalid settlement_date format. Use YYYY-MM-DD.",
                    status=400,
                )
        else:
            settlement_date = date_type.today()

        entry.status          = CashbookEntry.EntryStatus.CONFIRMED
        entry.settlement_date = settlement_date   # record actual settlement date
        entry.date            = settlement_date   # align main transaction date with settlement
        entry.save(update_fields=['status', 'settlement_date', 'date', 'updated_at'])

        return success_response(
            data=CashbookEntryDetailSerializer(entry).data,
            message=(
                f"{'Receivable' if entry.type == 'credit' else 'Payable'} "
                f"marked as done. ₹{entry.amount} added to your balance."
            ),
        )


# ─────────────────────────────────────────────
# PENDING ENTRIES  (all pending — receivables, payables, and general)
# GET /<business_id>/entries/pending-dues/
#
# Returns all PENDING entries ordered by due date.
# Used by Dashboard and Cashbook to show the
# "action required" list with Mark-as-Done CTAs.
# ─────────────────────────────────────────────
class PendingDuesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = CashbookEntry.objects.filter(
            business=business,
            status=CashbookEntry.EntryStatus.PENDING,
        ).select_related('category', 'branch', 'created_by').order_by('date')

        # Optional type filter  ?type=credit  or  ?type=debit
        type_filter = request.query_params.get('type')
        if type_filter:
            queryset = queryset.filter(type=type_filter)

        # Optional branch filter
        branch_id = request.query_params.get('branch')
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)

        serializer = CashbookEntryListSerializer(queryset, many=True)

        # Summary totals
        totals = queryset.aggregate(
            total_receivable=Sum(
                'amount', filter=Q(type=TransactionType.CREDIT)
            ),
            total_payable=Sum(
                'amount', filter=Q(type=TransactionType.DEBIT)
            ),
        )

        return success_response(data={
            'entries':          serializer.data,
            'total_receivable': totals['total_receivable'] or Decimal('0'),
            'total_payable':    totals['total_payable']    or Decimal('0'),
            'count':            queryset.count(),
        })


# ─────────────────────────────────────────────
# CASHBOOK BALANCE
# ─────────────────────────────────────────────
class CashbookBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset  = CashbookEntry.objects.filter(business=business)
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        branch_id = request.query_params.get('branch')

        if date_from:
            queryset = queryset.filter(date__gte=parse_date(date_from))
        if date_to:
            queryset = queryset.filter(date__lte=parse_date(date_to))
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)

        credit, debit, net, count = compute_balance(queryset)

        return success_response(data={
            'total_credit': credit,
            'total_debit':  debit,
            'net_balance':  net,
            'entry_count':  count,
            'date_from':    date_from,
            'date_to':      date_to,
        })


# ─────────────────────────────────────────────
# BRANCH-WISE STATS
# GET /<business_id>/stats/branches/
# Returns confirmed credit/debit totals per branch.
# Entries with no branch are grouped under branch_id=null ("Head Office").
# ─────────────────────────────────────────────
class BranchStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        # Only confirmed entries count towards financials
        base_qs = CashbookEntry.objects.filter(
            business=business,
            status=CashbookEntry.EntryStatus.CONFIRMED,
        )

        # Optional date filters
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        if date_from:
            base_qs = base_qs.filter(date__gte=parse_date(date_from))
        if date_to:
            base_qs = base_qs.filter(date__lte=parse_date(date_to))

        # Aggregate per branch (branch=None → HO / unassigned)
        rows = (
            base_qs
            .values('branch', 'branch__name')
            .annotate(
                total_credit=Sum('amount', filter=Q(type=TransactionType.CREDIT)),
                total_debit =Sum('amount', filter=Q(type=TransactionType.DEBIT)),
            )
            .order_by('branch__name')
        )

        branches = []
        for row in rows:
            branches.append({
                'branch_id':    str(row['branch']) if row['branch'] else None,
                'branch_name':  row['branch__name'] or None,
                'total_credit': row['total_credit'] or Decimal('0'),
                'total_debit':  row['total_debit']  or Decimal('0'),
            })

        return success_response(data={'branches': branches})


# ─────────────────────────────────────────────
# DAILY SUMMARY
# ─────────────────────────────────────────────
class DailyCashSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset  = DailyCashSummary.objects.filter(business=business)
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        branch_id = request.query_params.get('branch')

        if date_from:
            queryset = queryset.filter(date__gte=parse_date(date_from))
        if date_to:
            queryset = queryset.filter(date__lte=parse_date(date_to))
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)

        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = DailyCashSummarySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ─────────────────────────────────────────────
# BULK ENTRY CREATE
# ─────────────────────────────────────────────
class BulkCashbookEntryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not can_manage_cashbook(business, request.user):
            return error_response(message="Permission denied.", status=403)

        serializer = BulkCashbookEntrySerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Bulk entry failed.",
                errors=serializer.errors,
            )

        entries = serializer.save()
        return success_response(
            data={'created': len(entries)},
            message=f"{len(entries)} entries created successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# RECURRING TRANSACTIONS
# ─────────────────────────────────────────────
class RecurringTransactionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = RecurringTransaction.objects.filter(
            business=business
        ).select_related('category', 'branch', 'created_by')

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        serializer = RecurringTransactionSerializer(queryset, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        serializer = RecurringTransactionSerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Failed to create recurring transaction.",
                errors=serializer.errors,
            )

        recurring = serializer.save()
        return success_response(
            data=RecurringTransactionSerializer(recurring).data,
            message="Recurring transaction created successfully.",
            status=201,
        )


class RecurringTransactionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, business, pk):
        try:
            return RecurringTransaction.objects.get(pk=pk, business=business)
        except RecurringTransaction.DoesNotExist:
            return None

    def patch(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        recurring = self.get_object(business, pk)
        if not recurring:
            return error_response(message="Recurring transaction not found.", status=404)

        serializer = RecurringTransactionSerializer(
            recurring,
            data=request.data,
            partial=True,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(errors=serializer.errors)

        serializer.save()
        return success_response(
            data=serializer.data,
            message="Recurring transaction updated successfully.",
        )

    def delete(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        recurring = self.get_object(business, pk)
        if not recurring:
            return error_response(message="Recurring transaction not found.", status=404)

        recurring.is_active = False
        recurring.save(update_fields=['is_active'])
        return success_response(message="Recurring transaction deactivated.")