# apps/business/urls.py
# AIBMS – BharatSync AI
# Business URL Patterns

from django.urls import path
from .views import (
    BusinessListCreateView,
    BusinessDetailView,
    BusinessStatusView,
    BusinessMemberListView,
    BusinessMemberRemoveView,
    BusinessSettingsView,
    MyBusinessesView,
    CreateTeamMemberView,
)

urlpatterns = [

    # ── My Businesses (shortcut) ──────────────
    path('my/',                     MyBusinessesView.as_view(),         name='my-businesses'),

    # ── Business CRUD ─────────────────────────
    path('',                        BusinessListCreateView.as_view(),    name='business-list-create'),
    path('<uuid:pk>/',              BusinessDetailView.as_view(),        name='business-detail'),

    # ── Status Change (Super Admin) ───────────
    path('<uuid:pk>/status/',       BusinessStatusView.as_view(),        name='business-status'),

    # ── Members ───────────────────────────────
    path('<uuid:pk>/members/',             BusinessMemberListView.as_view(),   name='business-members'),
    path('<uuid:pk>/members/create/',      CreateTeamMemberView.as_view(),     name='create-team-member'),
    path(
        '<uuid:pk>/members/<uuid:member_id>/remove/',
        BusinessMemberRemoveView.as_view(),
        name='business-member-remove',
    ),

    # ── Settings ──────────────────────────────
    path('<uuid:pk>/settings/',     BusinessSettingsView.as_view(),      name='business-settings'),
]