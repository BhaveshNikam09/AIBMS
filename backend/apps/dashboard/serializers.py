# apps/dashboard/serializers.py
# AIBMS – BharatSync AI
# Business Owner Dashboard Serializers

from rest_framework import serializers


# ─────────────────────────────────────────────
# OVERVIEW CARDS
# ─────────────────────────────────────────────
class OverviewCardSerializer(serializers.Serializer):
    total_income       = serializers.FloatField()
    total_expense      = serializers.FloatField()
    net_profit         = serializers.FloatField()
    profit_margin      = serializers.FloatField()
    is_profitable      = serializers.BooleanField()
    income_change_pct  = serializers.FloatField()
    expense_change_pct = serializers.FloatField()
    profit_change_pct  = serializers.FloatField()
    health_score       = serializers.CharField()
    health_color       = serializers.CharField()


# ─────────────────────────────────────────────
# CASH FLOW TREND
# ─────────────────────────────────────────────
class MonthTrendSerializer(serializers.Serializer):
    month   = serializers.CharField()
    income  = serializers.FloatField()
    expense = serializers.FloatField()
    profit  = serializers.FloatField()


# ─────────────────────────────────────────────
# BRANCH SUMMARY
# ─────────────────────────────────────────────
class BranchSummarySerializer(serializers.Serializer):
    id           = serializers.CharField()
    name         = serializers.CharField()
    code         = serializers.CharField()
    branch_type  = serializers.CharField()
    income       = serializers.FloatField()
    expense      = serializers.FloatField()
    profit       = serializers.FloatField()
    rating       = serializers.CharField()
    rating_color = serializers.CharField()
    member_count = serializers.IntegerField()
    is_weak      = serializers.BooleanField()


# ─────────────────────────────────────────────
# RECENT TRANSACTIONS
# ─────────────────────────────────────────────
class RecentTransactionSerializer(serializers.Serializer):
    id           = serializers.CharField()
    date         = serializers.CharField()
    type         = serializers.CharField()
    amount       = serializers.FloatField()
    description  = serializers.CharField()
    party_name   = serializers.CharField()
    payment_mode = serializers.CharField()
    branch_name  = serializers.CharField()


# ─────────────────────────────────────────────
# TOP EXPENSES
# ─────────────────────────────────────────────
class TopExpenseSerializer(serializers.Serializer):
    description = serializers.CharField()
    total       = serializers.FloatField()
    count       = serializers.IntegerField()
    percentage  = serializers.FloatField()


# ─────────────────────────────────────────────
# FINANCIAL ALERTS
# ─────────────────────────────────────────────
class AlertSerializer(serializers.Serializer):
    level   = serializers.CharField()
    message = serializers.CharField()
    color   = serializers.CharField()


# ─────────────────────────────────────────────
# MEMBERS SUMMARY
# ─────────────────────────────────────────────
class MemberRoleSerializer(serializers.Serializer):
    role  = serializers.CharField()
    count = serializers.IntegerField()


class MembersSummarySerializer(serializers.Serializer):
    total_members = serializers.IntegerField()
    roles         = MemberRoleSerializer(many=True)


# ─────────────────────────────────────────────
# YEAR TO DATE
# ─────────────────────────────────────────────
class YearToDateSerializer(serializers.Serializer):
    total_income   = serializers.FloatField()
    total_expense  = serializers.FloatField()
    net_profit     = serializers.FloatField()
    profit_margin  = serializers.FloatField()
    best_month     = serializers.CharField()
    worst_month    = serializers.CharField()
    total_entries  = serializers.IntegerField()


# ─────────────────────────────────────────────
# ITR SUMMARY
# ─────────────────────────────────────────────
class ITRSummarySerializer(serializers.Serializer):
    total_itrs    = serializers.IntegerField()
    latest_year   = serializers.CharField()
    latest_status = serializers.CharField()
    latest_date   = serializers.CharField()


# ─────────────────────────────────────────────
# DOCUMENTS SUMMARY
# ─────────────────────────────────────────────
class DocumentSummarySerializer(serializers.Serializer):
    total_documents = serializers.IntegerField()
    recent_docs     = serializers.ListField()


# ─────────────────────────────────────────────
# AI INSIGHTS SUMMARY
# ─────────────────────────────────────────────
class AIInsightSerializer(serializers.Serializer):
    summary       = serializers.CharField()
    generated_at  = serializers.CharField()


# ─────────────────────────────────────────────
# FULL DASHBOARD RESPONSE
# ─────────────────────────────────────────────
class DashboardSerializer(serializers.Serializer):
    business_id   = serializers.CharField()
    business_name = serializers.CharField()
    owner_name    = serializers.CharField()
    generated_at  = serializers.CharField()
    period        = serializers.CharField()

    # Sections
    overview      = OverviewCardSerializer()
    year_to_date  = YearToDateSerializer()
    cash_flow     = MonthTrendSerializer(many=True)
    branches      = BranchSummarySerializer(many=True)
    transactions  = RecentTransactionSerializer(many=True)
    top_expenses  = TopExpenseSerializer(many=True)
    alerts        = AlertSerializer(many=True)
    members       = MembersSummarySerializer()
    itr           = ITRSummarySerializer()
    documents     = DocumentSummarySerializer()
    ai_insight    = AIInsightSerializer()