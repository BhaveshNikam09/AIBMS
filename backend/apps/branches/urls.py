# apps/branches/urls.py
# AIBMS – BharatSync AI
# Branch URL Patterns

from django.urls import path
from .views import (
    BranchListCreateView,
    BranchDetailView,
    BranchMemberListView,
    BranchMemberRemoveView,
    BranchOperatingHoursView,
    MyBranchesView,
)

urlpatterns = [

    # ── My Branches (across all businesses) ──
    path('my/',                     MyBranchesView.as_view(),           name='my-branches'),

    # ── Branch CRUD (under a business) ───────
    path(
        '<uuid:business_id>/',
        BranchListCreateView.as_view(),
        name='branch-list-create',
    ),
    path(
        '<uuid:business_id>/<uuid:branch_id>/',
        BranchDetailView.as_view(),
        name='branch-detail',
    ),

    # ── Branch Members ────────────────────────
    path(
        '<uuid:business_id>/<uuid:branch_id>/members/',
        BranchMemberListView.as_view(),
        name='branch-members',
    ),
    path(
        '<uuid:business_id>/<uuid:branch_id>/members/<uuid:member_id>/remove/',
        BranchMemberRemoveView.as_view(),
        name='branch-member-remove',
    ),

    # ── Operating Hours ───────────────────────
    path(
        '<uuid:business_id>/<uuid:branch_id>/hours/',
        BranchOperatingHoursView.as_view(),
        name='branch-operating-hours',
    ),
]