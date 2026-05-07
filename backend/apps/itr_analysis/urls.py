# apps/itr_analysis/urls.py
# AIBMS – BharatSync AI
# ITR Analysis URL Patterns

from django.urls import path
from .views import (
    ITRListUploadView,
    ITRDetailView,
    ITRStatusView,
    ITRAnalysisResultView,
    ITRReprocessView,
    ITRComparisonListCreateView,
    ITRComparisonDetailView,
    ITRQueryListCreateView,
    ITRQueryDetailView,
)

urlpatterns = [

    # ── ITR Records ───────────────────────────
    path(
        '<uuid:business_id>/',
        ITRListUploadView.as_view(),
        name='itr-list-upload',
    ),
    path(
        '<uuid:business_id>/<uuid:itr_id>/',
        ITRDetailView.as_view(),
        name='itr-detail',
    ),

    # ── Processing Status ─────────────────────
    path(
        '<uuid:business_id>/<uuid:itr_id>/status/',
        ITRStatusView.as_view(),
        name='itr-status',
    ),

    # ── Reprocess ─────────────────────────────
    path(
        '<uuid:business_id>/<uuid:itr_id>/reprocess/',
        ITRReprocessView.as_view(),
        name='itr-reprocess',
    ),

    # ── Analysis Result ───────────────────────
    path(
        '<uuid:business_id>/<uuid:itr_id>/analysis/',
        ITRAnalysisResultView.as_view(),
        name='itr-analysis',
    ),

    # ── Comparisons ───────────────────────────
    path(
        '<uuid:business_id>/comparisons/',
        ITRComparisonListCreateView.as_view(),
        name='itr-comparisons',
    ),
    path(
        '<uuid:business_id>/comparisons/<uuid:comparison_id>/',
        ITRComparisonDetailView.as_view(),
        name='itr-comparison-detail',
    ),

    # ── Queries ───────────────────────────────
    path(
        '<uuid:business_id>/<uuid:itr_id>/queries/',
        ITRQueryListCreateView.as_view(),
        name='itr-queries',
    ),
    path(
        '<uuid:business_id>/<uuid:itr_id>/queries/<uuid:query_id>/',
        ITRQueryDetailView.as_view(),
        name='itr-query-detail',
    ),
]