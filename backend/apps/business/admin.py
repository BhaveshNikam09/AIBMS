# apps/business/admin.py
# AIBMS – BharatSync AI
# Business Admin Panel Configuration

from django.contrib import admin
from django.utils.html import format_html
from .models import Business, BusinessMember, BusinessSettings


# ─────────────────────────────────────────────
# BUSINESS SETTINGS INLINE
# ─────────────────────────────────────────────
class BusinessSettingsInline(admin.StackedInline):
    model       = BusinessSettings
    can_delete  = False
    verbose_name = 'Business Settings'
    fields = [
        'enable_cashbook', 'enable_documents',
        'enable_itr', 'enable_ai_chatbot',
        'notify_on_entry', 'notify_on_document',
        'currency', 'currency_symbol',
    ]


# ─────────────────────────────────────────────
# BUSINESS MEMBER INLINE
# ─────────────────────────────────────────────
class BusinessMemberInline(admin.TabularInline):
    model      = BusinessMember
    extra      = 0
    fields     = ['user', 'status', 'invited_by', 'joined_at']
    readonly_fields = ['joined_at']


# ─────────────────────────────────────────────
# BUSINESS ADMIN
# ─────────────────────────────────────────────
@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):

    list_display = [
        'name', 'owner', 'category', 'status',
        'city', 'state', 'gstin',
        'total_branches', 'created_at', 'logo_preview',
    ]
    list_filter  = ['status', 'category', 'state', 'created_at']
    search_fields = ['name', 'legal_name', 'gstin', 'pan', 'owner__email']
    ordering     = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    inlines = [BusinessSettingsInline, BusinessMemberInline]

    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'name', 'legal_name', 'category', 'description', 'owner')
        }),
        ('Registration', {
            'fields': ('gstin', 'pan', 'registration_no', 'tan')
        }),
        ('Contact', {
            'fields': ('email', 'phone', 'website')
        }),
        ('Address', {
            'fields': (
                'address_line1', 'address_line2',
                'city', 'state', 'pincode', 'country',
            )
        }),
        ('Branding & Finance', {
            'fields': ('logo', 'brand_color', 'financial_year_start')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Logo')
    def logo_preview(self, obj):
        if obj.logo:
            return format_html(
                '<img src="{}" width="40" height="40" '
                'style="border-radius:6px;object-fit:cover;" />',
                obj.logo.url,
            )
        return format_html(
            '<span style="background:#6366f1;color:white;padding:4px 10px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            obj.name[:2].upper(),
        )

    @admin.display(description='Branches')
    def total_branches(self, obj):
        return obj.branches.count()

    actions = ['activate_businesses', 'suspend_businesses']

    @admin.action(description='Activate selected businesses')
    def activate_businesses(self, request, queryset):
        updated = queryset.update(status='active')
        self.message_user(request, f'{updated} business(es) activated.')

    @admin.action(description='Suspend selected businesses')
    def suspend_businesses(self, request, queryset):
        updated = queryset.update(status='suspended')
        self.message_user(request, f'{updated} business(es) suspended.')


# ─────────────────────────────────────────────
# BUSINESS MEMBER ADMIN
# ─────────────────────────────────────────────
@admin.register(BusinessMember)
class BusinessMemberAdmin(admin.ModelAdmin):

    list_display  = ['user', 'business', 'status', 'invited_by', 'joined_at']
    list_filter   = ['status', 'joined_at']
    search_fields = ['user__email', 'business__name']
    readonly_fields = ['id', 'joined_at']
    ordering      = ['-joined_at']


# ─────────────────────────────────────────────
# BUSINESS SETTINGS ADMIN
# ─────────────────────────────────────────────
@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):

    list_display  = [
        'business', 'enable_cashbook', 'enable_documents',
        'enable_itr', 'enable_ai_chatbot', 'currency',
    ]
    search_fields = ['business__name']
    readonly_fields = ['id', 'updated_at']