# apps/dashboard/urls.py
# AIBMS – BharatSync AI
# Business Owner Dashboard URLs

from django.urls import path
from .views import BusinessDashboardView, QuickStatsView

app_name = 'dashboard'

urlpatterns = [
    # Full dashboard
    path(
        '<uuid:business_id>/',
        BusinessDashboardView.as_view(),
        name='business-dashboard',
    ),

    # Lightweight quick stats
    path(
        '<uuid:business_id>/quick/',
        QuickStatsView.as_view(),
        name='quick-stats',
    ),
]