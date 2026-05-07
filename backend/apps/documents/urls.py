# apps/documents/urls.py
# AIBMS – BharatSync AI
# Document Management URL Patterns

from django.urls import path
from .views import (
    DocumentFolderListCreateView,
    DocumentFolderDetailView,
    DocumentListUploadView,
    DocumentDetailView,
    DocumentArchiveView,
    DocumentShareView,
    DocumentActivityLogView,
    MySharedDocumentsView,
    DocumentAnalyseView,
)

urlpatterns = [

    # ── My Shared Documents ───────────────────
    path(
        'shared/me/',
        MySharedDocumentsView.as_view(),
        name='my-shared-documents',
    ),

    # ── Document Folders ──────────────────────
    path(
        '<uuid:business_id>/folders/',
        DocumentFolderListCreateView.as_view(),
        name='document-folders',
    ),
    path(
        '<uuid:business_id>/folders/<uuid:pk>/',
        DocumentFolderDetailView.as_view(),
        name='document-folder-detail',
    ),

    # ── Documents ─────────────────────────────
    path(
        '<uuid:business_id>/files/',
        DocumentListUploadView.as_view(),
        name='document-list-upload',
    ),
    path(
        '<uuid:business_id>/files/<uuid:pk>/',
        DocumentDetailView.as_view(),
        name='document-detail',
    ),

    # ── Archive ───────────────────────────────
    path(
        '<uuid:business_id>/files/<uuid:pk>/archive/',
        DocumentArchiveView.as_view(),
        name='document-archive',
    ),

    # ── Analyse (AI extraction + cashbook push) ─
    path(
        '<uuid:business_id>/files/<uuid:pk>/analyse/',
        DocumentAnalyseView.as_view(),
        name='document-analyse',
    ),

    # ── Share ─────────────────────────────────
    path(
        '<uuid:business_id>/files/<uuid:pk>/share/',
        DocumentShareView.as_view(),
        name='document-share',
    ),

    # ── Activity Log ──────────────────────────
    path(
        '<uuid:business_id>/files/<uuid:pk>/activity/',
        DocumentActivityLogView.as_view(),
        name='document-activity',
    ),
]