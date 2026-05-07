# apps/dashboard/views.py
# AIBMS – BharatSync AI
# Business Owner Dashboard — Main Logic

import logging
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_financials(entries, TransactionType):
    from django.db.models import Sum
    credit = entries.filter(type=TransactionType.CREDIT).aggregate(
        total=Sum('amount'))['total'] or 0
    debit  = entries.filter(type=TransactionType.DEBIT).aggregate(
        total=Sum('amount'))['total'] or 0
    return float(credit), float(debit)


def pct_change(current, previous):
    if previous == 0:
        return 0.0
    return round(((current - previous) / previous) * 100, 1)


def get_health(profit_margin):
    if profit_margin > 30:
        return '🟢 Healthy',    'green'
    elif profit_margin > 10:
        return '🟡 Moderate',   'yellow'
    elif profit_margin > 0:
        return '🟠 Low Margin', 'orange'
    else:
        return '🔴 Loss Making', 'red'


def get_rating(profit):
    if profit > 50000:
        return '🟢 Excellent', 'green'
    elif profit > 0:
        return '🟡 Good',      'yellow'
    elif profit > -20000:
        return '🟠 Weak',      'orange'
    else:
        return '🔴 Critical',  'red'


# ─────────────────────────────────────────────
# PERIOD HELPERS
# ─────────────────────────────────────────────
def resolve_period(period_param):
    """
    Returns (date_from, date_to, granularity).
    granularity: 'daily' | 'monthly'

    Supported period values:
        'daily'    → today only          (granularity = daily, each hour grouping)
        '1month'   → last 30 days        (granularity = daily)
        '3months'  → last 3 months       (granularity = monthly)
        '6months'  → last 6 months       (granularity = monthly)  [default]
        '1yr'      → last 12 months      (granularity = monthly)
    """
    today = date.today()
    p = (period_param or '6months').strip().lower()

    if p == 'daily':
        return today, today, 'daily'
    elif p == '1month':
        return today - timedelta(days=29), today, 'daily'
    elif p == '3months':
        return today - timedelta(days=89), today, 'monthly'
    elif p == '1yr':
        return today - timedelta(days=364), today, 'monthly'
    else:  # default 6months
        return today - timedelta(days=179), today, 'monthly'


# ─────────────────────────────────────────────
# OVERVIEW CARDS  (period-aware)
# ─────────────────────────────────────────────
def build_overview(business_id, period='6months'):
    from apps.cashbook.models import CashbookEntry, TransactionType

    today = date.today()
    date_from, date_to, _ = resolve_period(period)

    # For comparison we use the same-length window just before date_from
    window_days  = (date_to - date_from).days + 1
    prev_to      = date_from - timedelta(days=1)
    prev_from    = prev_to - timedelta(days=window_days - 1)

    curr_entries = CashbookEntry.objects.filter(
        business_id=business_id,
        date__gte=date_from,
        date__lte=date_to,
        status='confirmed',
    )
    prev_entries = CashbookEntry.objects.filter(
        business_id=business_id,
        date__gte=prev_from,
        date__lte=prev_to,
        status='confirmed',
    )

    curr_income,  curr_expense  = get_financials(curr_entries, TransactionType)
    prev_income,  prev_expense  = get_financials(prev_entries, TransactionType)
    curr_profit  = curr_income  - curr_expense
    prev_profit  = prev_income  - prev_expense
    profit_margin = (curr_profit / curr_income * 100) if curr_income > 0 else 0

    health_score, health_color = get_health(profit_margin)

    return {
        'total_income':       curr_income,
        'total_expense':      curr_expense,
        'net_profit':         curr_profit,
        'profit_margin':      round(profit_margin, 1),
        'is_profitable':      curr_profit >= 0,
        'income_change_pct':  pct_change(curr_income,  prev_income),
        'expense_change_pct': pct_change(curr_expense, prev_expense),
        'profit_change_pct':  pct_change(curr_profit,  prev_profit),
        'health_score':       health_score,
        'health_color':       health_color,
    }


# ─────────────────────────────────────────────
# YEAR TO DATE
# ─────────────────────────────────────────────
def build_year_to_date(business_id):
    from apps.cashbook.models import CashbookEntry, TransactionType
    import calendar

    today      = date.today()
    year_start = date(today.year, 1, 1)

    entries = CashbookEntry.objects.filter(
        business_id=business_id,
        date__gte=year_start,
        date__lte=today,
        status='confirmed',
    )

    total_income, total_expense = get_financials(entries, TransactionType)
    net_profit    = total_income - total_expense
    profit_margin = (net_profit / total_income * 100) if total_income > 0 else 0
    total_entries = entries.count()

    best_month  = ''
    worst_month = ''
    best_profit  = None
    worst_profit = None

    for m in range(1, today.month + 1):
        last_day   = calendar.monthrange(today.year, m)[1]
        m_from     = date(today.year, m, 1)
        m_to       = date(today.year, m, last_day)
        m_entries  = entries.filter(date__gte=m_from, date__lte=m_to)
        m_inc, m_exp = get_financials(m_entries, TransactionType)
        m_profit   = m_inc - m_exp
        m_name     = m_from.strftime('%B %Y')

        if best_profit is None or m_profit > best_profit:
            best_profit = m_profit
            best_month  = m_name
        if worst_profit is None or m_profit < worst_profit:
            worst_profit = m_profit
            worst_month  = m_name

    return {
        'total_income':  total_income,
        'total_expense': total_expense,
        'net_profit':    net_profit,
        'profit_margin': round(profit_margin, 1),
        'best_month':    best_month,
        'worst_month':   worst_month,
        'total_entries': total_entries,
    }


# ─────────────────────────────────────────────
# CASH FLOW TREND  (period-aware)
# ─────────────────────────────────────────────
def build_cash_flow(business_id, period='6months'):
    """
    period: 'daily' | '1month' | '3months' | '6months' | '1yr'

    - 'daily'   → hourly slots for today (9am onward)
    - '1month'  → one row per day for last 30 days (zero-filled)
    - '3months' → one row per month for last 3 months
    - '6months' → one row per month for last 6 months
    - '1yr'     → one row per month for last 12 months
    """
    from apps.cashbook.models import CashbookEntry, TransactionType
    import calendar

    date_from, date_to, granularity = resolve_period(period)
    period_param = (period or '6months').strip().lower()
    trend_data = []

    if granularity == 'daily':
        if period_param == 'daily':
            # ── TODAY → hourly slots (9 AM – current hour, min 8 slots) ──────
            from datetime import datetime
            now        = timezone.localtime(timezone.now())   # tz-aware local time
            start_hour = 9   # business day start
            end_hour   = max(now.hour, start_hour + 7)  # at least 8 slots

            # Fetch all of today's entries once
            all_today = CashbookEntry.objects.filter(
                business_id=business_id,
                date=date_from,           # date_from == today for 'daily'
                status='confirmed',
            ).select_related()

            # Build a map: hour → (income, expense) using created_at time
            from django.db.models import Sum
            from apps.cashbook.models import TransactionType as TT

            # Group by hour using Python (avoids DB-level time functions)
            hour_map = {}
            for entry in all_today:
                # Use created_at hour if available, else spread evenly
                try:
                    local_dt = timezone.localtime(entry.created_at)
                    h = local_dt.hour
                except Exception:
                    h = start_hour
                h = max(start_hour, min(h, end_hour))
                if h not in hour_map:
                    hour_map[h] = {'income': 0.0, 'expense': 0.0}
                amount = float(entry.amount)
                if entry.type == TT.CREDIT:
                    hour_map[h]['income']  += amount
                else:
                    hour_map[h]['expense'] += amount

            for h in range(start_hour, end_hour + 1):
                vals    = hour_map.get(h, {'income': 0.0, 'expense': 0.0})
                inc     = vals['income']
                exp     = vals['expense']
                label   = f"{h % 12 or 12}{'am' if h < 12 else 'pm'}"  # 9am, 12pm …
                trend_data.append({
                    'month':   label,
                    'income':  inc,
                    'expense': exp,
                    'profit':  inc - exp,
                })

        else:
            # ── 1MONTH → one row per day, zero-fill gaps ──────────────────────
            # Build a dict of date → financials from DB first
            all_entries = CashbookEntry.objects.filter(
                business_id=business_id,
                date__gte=date_from,
                date__lte=date_to,
                status='confirmed',
            )
            from apps.cashbook.models import TransactionType as TT
            day_map = {}
            for entry in all_entries:
                key    = entry.date
                if key not in day_map:
                    day_map[key] = {'income': 0.0, 'expense': 0.0}
                amount = float(entry.amount)
                if entry.type == TT.CREDIT:
                    day_map[key]['income']  += amount
                else:
                    day_map[key]['expense'] += amount

            cursor = date_from
            while cursor <= date_to:
                vals = day_map.get(cursor, {'income': 0.0, 'expense': 0.0})
                inc  = vals['income']
                exp  = vals['expense']
                # %-d (no-pad day) can raise ValueError on some platforms/Windows
                try:
                    day_label = cursor.strftime('%-d %b')
                except ValueError:
                    day_label = cursor.strftime('%d %b').lstrip('0') or cursor.strftime('%d %b')
                trend_data.append({
                    'month':   day_label,
                    'income':  inc,
                    'expense': exp,
                    'profit':  inc - exp,
                })
                cursor += timedelta(days=1)

    else:
        # iterate month by month
        # collect unique (year, month) pairs in the range
        months = []
        cursor = date_from.replace(day=1)
        end_month = date_to.replace(day=1)
        while cursor <= end_month:
            months.append((cursor.year, cursor.month))
            # advance one month
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

        for year, month in months:
            try:
                last_day   = calendar.monthrange(year, month)[1]
                month_from = date(year, month, 1)
                month_to   = date(year, month, last_day)
                month_name = month_from.strftime('%b %Y')

                entries = CashbookEntry.objects.filter(
                    business_id=business_id,
                    date__gte=month_from,
                    date__lte=month_to,
                    status='confirmed',
                )

                income, expense = get_financials(entries, TransactionType)
                trend_data.append({
                    'month':   month_name,
                    'income':  income,
                    'expense': expense,
                    'profit':  income - expense,
                })
            except Exception as e:
                logger.error(f"Cash flow month error: {e}")
                continue

    return trend_data


# ─────────────────────────────────────────────
# BRANCH SUMMARY
# ─────────────────────────────────────────────
def build_branches(business_id):
    try:
        from apps.cashbook.models import CashbookEntry, TransactionType
        from apps.branches.models import Branch, BranchMember

        branches    = Branch.objects.filter(business_id=business_id, is_active=True)
        branch_data = []

        for branch in branches:
            # All-time confirmed entries for this branch
            entries = CashbookEntry.objects.filter(
                business_id=business_id,
                branch_id=branch.id,
                status='confirmed',
            )

            income, expense = get_financials(entries, TransactionType)
            profit          = income - expense
            rating, color   = get_rating(profit)

            member_count = BranchMember.objects.filter(
                branch=branch, is_active=True
            ).count()

            branch_data.append({
                'id':           str(branch.id),
                'name':         branch.name,
                'code':         getattr(branch, 'code', ''),
                'branch_type':  getattr(branch, 'branch_type', ''),
                'income':       income,
                'expense':      expense,
                'profit':       profit,
                'rating':       rating,
                'rating_color': color,
                'member_count': member_count,
                'is_weak':      profit < 0,
            })

        branch_data.sort(key=lambda x: x['profit'], reverse=True)
        return branch_data
    except Exception as e:
        logger.error(f"Branches summary error: {e}")
        return []


# ─────────────────────────────────────────────
# RECENT TRANSACTIONS
# ─────────────────────────────────────────────
def build_recent_transactions(business_id, limit=10):
    try:
        from apps.cashbook.models import CashbookEntry

        entries = CashbookEntry.objects.filter(
            business_id=business_id,
            status='confirmed',
        ).select_related('branch').order_by('-date', '-created_at')[:limit]

        result = []
        for e in entries:
            result.append({
                'id':           str(e.id),
                'date':         str(e.date),
                'type':         e.type,
                'amount':       float(e.amount),
                'description':  e.description or '',
                'party_name':   e.party_name  or '',
                'payment_mode': e.payment_mode or '',
                'branch_name':  e.branch.name if e.branch else 'Main',
            })

        return result
    except Exception as e:
        logger.error(f"Recent transactions error: {e}")
        return []


# ─────────────────────────────────────────────
# TOP EXPENSES
# ─────────────────────────────────────────────
def build_top_expenses(business_id, limit=5):
    try:
        from apps.cashbook.models import CashbookEntry, TransactionType
        from django.db.models import Sum, Count

        today      = date.today()
        this_month = today.replace(day=1)

        entries = CashbookEntry.objects.filter(
            business_id=business_id,
            type=TransactionType.DEBIT,
            date__gte=this_month,
            date__lte=today,
            status='confirmed',
        )

        grouped = (
            entries
            .values('description')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')[:limit]
        )

        total_expense = entries.aggregate(total=Sum('amount'))['total'] or 1

        result = []
        for g in grouped:
            result.append({
                'description': g['description'] or 'Other',
                'total':       float(g['total']),
                'count':       g['count'],
                'percentage':  round(float(g['total']) / float(total_expense) * 100, 1),
            })

        return result
    except Exception as e:
        logger.error(f"Top expenses error: {e}")
        return []


# ─────────────────────────────────────────────
# FINANCIAL ALERTS
# ─────────────────────────────────────────────
def build_alerts(business_id):
    try:
        from apps.cashbook.models import CashbookEntry, TransactionType

        today          = date.today()
        this_month     = today.replace(day=1)
        last_month     = (this_month - timedelta(days=1)).replace(day=1)
        last_month_end = this_month - timedelta(days=1)

        curr_entries = CashbookEntry.objects.filter(
            business_id=business_id,
            date__gte=this_month,
            date__lte=today,
            status='confirmed',
        )
        prev_entries = CashbookEntry.objects.filter(
            business_id=business_id,
            date__gte=last_month,
            date__lte=last_month_end,
            status='confirmed',
        )

        curr_income,  curr_expense = get_financials(curr_entries, TransactionType)
        prev_income,  prev_expense = get_financials(prev_entries, TransactionType)

        alerts = []

        if curr_expense > curr_income and curr_income > 0:
            loss = curr_expense - curr_income
            alerts.append({
                'level':   '🔴 Critical',
                'message': f'Expenses exceeded income! Net loss: ₹{loss:,.2f}',
                'color':   'red',
            })

        if prev_expense > 0:
            exp_change = pct_change(curr_expense, prev_expense)
            if exp_change > 25:
                alerts.append({
                    'level':   '🟠 Warning',
                    'message': f'Expenses up {exp_change:.1f}% vs last month.',
                    'color':   'orange',
                })

        if prev_income > 0:
            inc_change = pct_change(curr_income, prev_income)
            if inc_change < -20:
                alerts.append({
                    'level':   '🟠 Warning',
                    'message': f'Income dropped {abs(inc_change):.1f}% vs last month.',
                    'color':   'orange',
                })

        if curr_income == 0:
            alerts.append({
                'level':   '🟡 Notice',
                'message': 'No income recorded this month yet.',
                'color':   'yellow',
            })

        if curr_income > 0:
            ratio = (curr_expense / curr_income) * 100
            if ratio > 80:
                alerts.append({
                    'level':   '🟠 Warning',
                    'message': f'Expense ratio is {ratio:.1f}% of income.',
                    'color':   'orange',
                })

        if not alerts:
            alerts.append({
                'level':   '🟢 All Good',
                'message': 'No alerts. Business is on track!',
                'color':   'green',
            })

        return alerts
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        return [{'level': '🟡 Notice', 'message': 'Could not load alerts.', 'color': 'yellow'}]


# ─────────────────────────────────────────────
# MEMBERS SUMMARY
# ─────────────────────────────────────────────
def build_members_summary(business_id):
    try:
        from apps.business.models import BusinessMember

        members = BusinessMember.objects.filter(
            business_id=business_id,
            status='active',
        ).select_related('user')

        total = members.count()

        role_counts = {}
        for m in members:
            role = getattr(m, 'role', None) or getattr(m.user, 'role', 'member')
            role_counts[role] = role_counts.get(role, 0) + 1

        roles = [{'role': role, 'count': count} for role, count in role_counts.items()]

        return {
            'total_members': total,
            'roles':         roles,
        }
    except Exception as e:
        logger.error(f"Members summary error: {e}")
        return {'total_members': 0, 'roles': []}


# ─────────────────────────────────────────────
# ITR SUMMARY
# ─────────────────────────────────────────────
def build_itr_summary(business_id):
    try:
        from apps.itr_analysis.models import ITRRecord

        itrs   = ITRRecord.objects.filter(business_id=business_id)
        latest = itrs.order_by('-assessment_year').first()

        return {
            'total_itrs':    itrs.count(),
            'latest_year':   latest.assessment_year if latest else 'N/A',
            'latest_status': latest.status          if latest else 'N/A',
            'latest_date':   str(latest.created_at.date()) if latest else 'N/A',
        }
    except Exception as e:
        logger.error(f"ITR summary error: {e}")
        return {'total_itrs': 0, 'latest_year': 'N/A', 'latest_status': 'N/A', 'latest_date': 'N/A'}


# ─────────────────────────────────────────────
# DOCUMENTS SUMMARY
# ─────────────────────────────────────────────
def build_documents_summary(business_id):
    try:
        from apps.documents.models import Document

        docs = Document.objects.filter(
            business_id=business_id,
        ).exclude(status='archived')

        recent = list(
            docs.order_by('-created_at')[:5].values(
                'id', 'title', 'category', 'file_type', 'created_at'
            )
        )

        for doc in recent:
            doc['id']         = str(doc['id'])
            doc['name']       = doc.pop('title', '')
            doc['created_at'] = str(doc['created_at'].date())

        return {
            'total_documents': docs.count(),
            'recent_docs':     recent,
        }
    except Exception as e:
        logger.error(f"Documents summary error: {e}")
        return {'total_documents': 0, 'recent_docs': []}


# ─────────────────────────────────────────────
# AI INSIGHT SUMMARY  (with 1-hour in-memory cache)
# ─────────────────────────────────────────────
import time as _time
_AI_INSIGHT_CACHE: dict = {}   # {business_id: {'summary': ..., 'ts': float, 'generated_at': str}}
_AI_INSIGHT_TTL   = 3600       # 1 hour — callers don't need fresher data on every page load


def _fallback_insight(overview: dict) -> dict:
    """Return a rule-based summary when Gemini is unavailable/rate-limited."""
    profit = overview.get('net_profit', 0)
    margin = overview.get('profit_margin', 0)
    if profit > 0:
        summary = (
            f"✅ Business is profitable this month with ₹{profit:,.2f} net profit "
            f"and {margin}% margin. Keep monitoring expenses to maintain healthy margins. "
            f"Focus on growing income streams for better performance."
        )
    else:
        loss = abs(profit)
        summary = (
            f"⚠️ Business recorded a loss of ₹{loss:,.2f} this month. "
            f"Review your top expense categories and reduce unnecessary spending. "
            f"Focus on increasing income to return to profitability."
        )
    return {'summary': summary, 'generated_at': str(timezone.now())}


def build_ai_insight(business_id, overview, branches):
    biz_key = str(business_id)

    # ── Cache hit? ────────────────────────────────────────────────────────────
    cached = _AI_INSIGHT_CACHE.get(biz_key)
    if cached and (_time.time() - cached['ts']) < _AI_INSIGHT_TTL:
        return {'summary': cached['summary'], 'generated_at': cached['generated_at']}

    # ── Try Gemini ────────────────────────────────────────────────────────────
    try:
        import google.generativeai as genai
        from django.conf import settings

        if not getattr(settings, 'GEMINI_API_KEY', None):
            raise ValueError("No Gemini API key configured.")

        weak_branches = [b for b in branches if b.get('is_weak')]
        weak_text     = ', '.join([b['name'] for b in weak_branches]) if weak_branches else 'None'

        prompt = (
            "You are BharatSync AI. Generate a 3-sentence business health summary.\n\n"
            "This Month:\n"
            f"- Income:  ₹{overview['total_income']:,.2f}\n"
            f"- Expense: ₹{overview['total_expense']:,.2f}\n"
            f"- Profit:  ₹{overview['net_profit']:,.2f}\n"
            f"- Margin:  {overview['profit_margin']}%\n"
            f"- Health:  {overview['health_score']}\n"
            f"- Income Change:  {overview['income_change_pct']:+.1f}%\n"
            f"- Expense Change: {overview['expense_change_pct']:+.1f}%\n"
            f"- Weak Branches:  {weak_text}\n\n"
            "Write 3 short, actionable sentences. Use emojis. Be direct and friendly."
        )

        # Use gemini-2.5-flash to match the rest of the application
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model    = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        summary  = response.text.strip()
        generated_at = str(timezone.now())

        # Store in cache
        _AI_INSIGHT_CACHE[biz_key] = {
            'summary':      summary,
            'ts':           _time.time(),
            'generated_at': generated_at,
        }

        return {'summary': summary, 'generated_at': generated_at}

    except Exception as e:
        logger.error(f"AI insight error: {e}")
        # Cache the fallback result too so we don't hammer Gemini every refresh
        result = _fallback_insight(overview)
        _AI_INSIGHT_CACHE[biz_key] = {
            'summary':      result['summary'],
            'ts':           _time.time() - (_AI_INSIGHT_TTL - 300),  # re-try in 5 min
            'generated_at': result['generated_at'],
        }
        return result


# ─────────────────────────────────────────────
# MAIN DASHBOARD VIEW
# ─────────────────────────────────────────────
class BusinessDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        from apps.business.models import Business, BusinessMember

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Business not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_owner  = str(business.owner_id) == str(request.user.id)
        is_member = BusinessMember.objects.filter(
            business_id=business_id,
            user=request.user,
            status='active',
        ).exists()

        if not is_owner and not is_member:
            return Response(
                {'success': False, 'message': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Read period query param (?period=daily|1month|3months|6months) ──
        period = request.query_params.get('period', '6months')

        try:
            overview     = build_overview(business_id, period=period)
            year_to_date = build_year_to_date(business_id)
            cash_flow    = build_cash_flow(business_id, period=period)
            branches     = build_branches(business_id)
            transactions = build_recent_transactions(business_id)
            top_expenses = build_top_expenses(business_id)
            alerts       = build_alerts(business_id)
            members      = build_members_summary(business_id)
            itr          = build_itr_summary(business_id)
            documents    = build_documents_summary(business_id)
            ai_insight   = build_ai_insight(business_id, overview, branches)

            owner_name = getattr(request.user, 'full_name', None) or request.user.email

            dashboard_data = {
                'business_id':   str(business_id),
                'business_name': business.name,
                'owner_name':    owner_name,
                'generated_at':  str(timezone.now()),
                'period':        date.today().strftime('%B %Y'),
                'active_period': period,                          # echo back to frontend
                'overview':      overview,
                'year_to_date':  year_to_date,
                'cash_flow':     cash_flow,
                'branches':      branches,
                'transactions':  transactions,
                'top_expenses':  top_expenses,
                'alerts':        alerts,
                'members':       members,
                'itr':           itr,
                'documents':     documents,
                'ai_insight':    ai_insight,
            }

            return Response({
                'success': True,
                'message': 'Dashboard loaded successfully.',
                'data':    dashboard_data,
            })

        except Exception as e:
            logger.error(f"Dashboard error: {e}", exc_info=True)
            return Response(
                {'success': False, 'message': f'Dashboard error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─────────────────────────────────────────────
# QUICK STATS VIEW (lightweight)
# ─────────────────────────────────────────────
class QuickStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        from apps.business.models import Business, BusinessMember

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Business not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_owner  = str(business.owner_id) == str(request.user.id)
        is_member = BusinessMember.objects.filter(
            business_id=business_id,
            user=request.user,
            status='active',
        ).exists()

        if not is_owner and not is_member:
            return Response(
                {'success': False, 'message': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = request.query_params.get('period', '6months')

        try:
            overview = build_overview(business_id, period=period)
            alerts   = build_alerts(business_id)

            return Response({
                'success': True,
                'message': 'Quick stats loaded.',
                'data': {
                    'business_name': business.name,
                    'period':        date.today().strftime('%B %Y'),
                    'active_period': period,
                    'overview':      overview,
                    'alerts':        alerts,
                },
            })

        except Exception as e:
            logger.error(f"Quick stats error: {e}", exc_info=True)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )