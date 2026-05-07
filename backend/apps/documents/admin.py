# apps/documents/admin.py
# AIBMS – BharatSync AI
# Document Management Admin Panel Configuration

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    Document,
    DocumentFolder,
    DocumentShare,
    DocumentActivityLog,
    DocumentStatus,
)


# ─────────────────────────────────────────────
# DOCUMENT INLINE (inside folder)
# ─────────────────────────────────────────────
class DocumentInline(admin.TabularInline):
    model           = Document
    extra           = 0
    fields          = ['title', 'category', 'status', 'uploaded_by', 'created_at']
    readonly_fields = ['created_at']
    show_change_link = True


# ─────────────────────────────────────────────
# DOCUMENT FOLDER ADMIN
# ─────────────────────────────────────────────
@admin.register(DocumentFolder)
class DocumentFolderAdmin(admin.ModelAdmin):

    list_display  = [
        'name', 'business', 'parent',
        'document_count', 'is_active',
        'color_preview', 'created_by', 'created_at',
    ]
    list_filter   = ['is_active', 'created_at']
    search_fields = ['name', 'business__name']
    ordering      = ['name']
    readonly_fields = ['id', 'created_at']
    inlines       = [DocumentInline]

    @admin.display(description='Color')
    def color_preview(self, obj):
        return format_html(
            '<span style="background:{};padding:3px 10px;'
            'border-radius:4px;color:white;font-size:11px;">{}</span>',
            obj.color,
            obj.color,
        )

    @admin.display(description='Documents')
    def document_count(self, obj):
        return obj.documents.filter(status=DocumentStatus.ACTIVE).count()


# ─────────────────────────────────────────────
# DOCUMENT ADMIN
# ─────────────────────────────────────────────
@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):

    list_display  = [
        'title', 'business', 'category',
        'file_extension', 'file_size_display',
        'status_badge', 'is_confidential',
        'expiry_badge', 'uploaded_by', 'created_at',
    ]
    list_filter   = [
        'category', 'status', 'is_confidential',
        'file_extension', 'created_at',
    ]
    search_fields = [
        'title', 'description',
        'business__name', 'uploaded_by__email',
    ]
    ordering      = ['-created_at']
    readonly_fields = [
        'id', 'file_name', 'file_size',
        'file_type', 'file_extension',
        's3_key', 's3_bucket',
        'uploaded_by', 'created_at', 'updated_at',
    ]
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Document Info', {
            'fields': (
                'id', 'business', 'branch', 'folder',
                'title', 'description', 'category', 'tags',
            )
        }),
        ('File Info', {
            'fields': (
                'file', 'file_name', 'file_size',
                'file_type', 'file_extension',
            )
        }),
        ('S3 Storage', {
            'fields': ('s3_key', 's3_bucket'),
            'classes': ('collapse',),
        }),
        ('Status & Dates', {
            'fields': (
                'status', 'is_confidential',
                'expiry_date', 'document_date',
            )
        }),
        ('Meta', {
            'fields': ('uploaded_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Status')
    def status_badge(self, obj):
        colors = {
            'active':   '#22c55e',
            'archived': '#6366f1',
            'deleted':  '#ef4444',
            'expired':  '#f59e0b',
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='Expiry')
    def expiry_badge(self, obj):
        if not obj.expiry_date:
            return '—'
        today = timezone.now().date()
        days  = (obj.expiry_date - today).days
        if days < 0:
            return format_html(
                '<span style="color:#ef4444;font-weight:bold;">Expired</span>'
            )
        if days <= 30:
            return format_html(
                '<span style="color:#f59e0b;font-weight:bold;">'
                'Expiring in {} days</span>',
                days,
            )
        return format_html(
            '<span style="color:#22c55e;">{}</span>',
            obj.expiry_date,
        )

    actions = ['archive_documents', 'restore_documents']

    @admin.action(description='Archive selected documents')
    def archive_documents(self, request, queryset):
        updated = queryset.exclude(
            status=DocumentStatus.DELETED
        ).update(status=DocumentStatus.ARCHIVED)
        self.message_user(request, f'{updated} document(s) archived.')

    @admin.action(description='Restore selected documents to Active')
    def restore_documents(self, request, queryset):
        updated = queryset.exclude(
            status=DocumentStatus.DELETED
        ).update(status=DocumentStatus.ACTIVE)
        self.message_user(request, f'{updated} document(s) restored.')


# ─────────────────────────────────────────────
# DOCUMENT SHARE ADMIN
# ─────────────────────────────────────────────
@admin.register(DocumentShare)
class DocumentShareAdmin(admin.ModelAdmin):

    list_display  = [
        'document', 'shared_with', 'shared_by',
        'share_type', 'expires_at',
        'validity_badge', 'created_at',
    ]
    list_filter   = ['share_type', 'created_at']
    search_fields = [
        'document__title',
        'shared_with__email',
        'shared_by__email',
    ]
    readonly_fields = ['id', 'created_at']
    ordering        = ['-created_at']

    def has_add_permission(self, request):
        return False

    @admin.display(description='Valid')
    def validity_badge(self, obj):
        if obj.is_valid():
            return format_html(
                '<span style="color:#22c55e;font-weight:bold;">✓ Valid</span>'
            )
        return format_html(
            '<span style="color:#ef4444;font-weight:bold;">✗ Expired</span>'
        )


# ─────────────────────────────────────────────
# DOCUMENT ACTIVITY LOG ADMIN
# ─────────────────────────────────────────────
@admin.register(DocumentActivityLog)
class DocumentActivityLogAdmin(admin.ModelAdmin):

    list_display  = [
        'document', 'user', 'action_badge',
        'ip_address', 'timestamp',
    ]
    list_filter   = ['action', 'timestamp']
    search_fields = [
        'document__title',
        'user__email',
        'ip_address',
    ]
    readonly_fields = [
        'id', 'document', 'user',
        'action', 'ip_address',
        'metadata', 'timestamp',
    ]
    ordering = ['-timestamp']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description='Action')
    def action_badge(self, obj):
        colors = {
            'uploaded':   '#6366f1',
            'viewed':     '#22c55e',
            'downloaded': '#3b82f6',
            'updated':    '#f59e0b',
            'deleted':    '#ef4444',
            'shared':     '#8b5cf6',
            'archived':   '#6b7280',
        }
        color = colors.get(obj.action, '#6b7280')
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color,
            obj.get_action_display(),
        )