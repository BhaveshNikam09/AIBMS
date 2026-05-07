# apps/branches/admin.py
# AIBMS – BharatSync AI
# Branch Admin Panel Configuration

from django.contrib import admin
from django.utils.html import format_html
from .models import Branch, BranchMember, BranchOperatingHours


# ─────────────────────────────────────────────
# BRANCH MEMBER INLINE
# ─────────────────────────────────────────────
class BranchMemberInline(admin.TabularInline):
    model           = BranchMember
    extra           = 0
    fields          = ['user', 'role', 'is_active', 'assigned_by', 'joined_at']
    readonly_fields = ['joined_at']


# ─────────────────────────────────────────────
# OPERATING HOURS INLINE
# ─────────────────────────────────────────────
class BranchOperatingHoursInline(admin.TabularInline):
    model   = BranchOperatingHours
    extra   = 0
    fields  = ['day', 'open_time', 'close_time', 'is_closed']
    ordering = ['day']


# ─────────────────────────────────────────────
# BRANCH ADMIN
# ─────────────────────────────────────────────
@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):

    list_display = [
        'name', 'code', 'business', 'branch_type',
        'manager', 'city', 'state',
        'is_active', 'is_primary', 'created_at',
        'status_badge',
    ]
    list_filter  = [
        'branch_type', 'is_active', 'is_primary',
        'state', 'created_at',
    ]
    search_fields = [
        'name', 'code', 'business__name',
        'manager__email', 'city',
    ]
    ordering      = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    inlines = [BranchMemberInline, BranchOperatingHoursInline]

    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'business', 'name', 'code', 'branch_type')
        }),
        ('Manager', {
            'fields': ('manager',)
        }),
        ('Contact', {
            'fields': ('email', 'phone')
        }),
        ('Address', {
            'fields': (
                'address_line1', 'address_line2',
                'city', 'state', 'pincode', 'country',
                'latitude', 'longitude',
            )
        }),
        ('Status', {
            'fields': ('is_active', 'is_primary')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Status')
    def status_badge(self, obj):
        if obj.is_active and obj.is_primary:
            return format_html(
                '<span style="background:#6366f1;color:white;padding:3px 8px;'
                'border-radius:4px;font-size:11px;">Primary</span>'
            )
        if obj.is_active:
            return format_html(
                '<span style="background:#22c55e;color:white;padding:3px 8px;'
                'border-radius:4px;font-size:11px;">Active</span>'
            )
        return format_html(
            '<span style="background:#ef4444;color:white;padding:3px 8px;'
            'border-radius:4px;font-size:11px;">Inactive</span>'
        )

    actions = ['activate_branches', 'deactivate_branches']

    @admin.action(description='Activate selected branches')
    def activate_branches(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} branch(es) activated.')

    @admin.action(description='Deactivate selected branches')
    def deactivate_branches(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} branch(es) deactivated.')


# ─────────────────────────────────────────────
# BRANCH MEMBER ADMIN
# ─────────────────────────────────────────────
@admin.register(BranchMember)
class BranchMemberAdmin(admin.ModelAdmin):

    list_display  = [
        'user', 'branch', 'role',
        'is_active', 'assigned_by', 'joined_at',
    ]
    list_filter   = ['role', 'is_active', 'joined_at']
    search_fields = [
        'user__email', 'user__full_name',
        'branch__name', 'branch__business__name',
    ]
    readonly_fields = ['id', 'joined_at']
    ordering        = ['-joined_at']

    actions = ['activate_members', 'deactivate_members']

    @admin.action(description='Activate selected members')
    def activate_members(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} member(s) activated.')

    @admin.action(description='Deactivate selected members')
    def deactivate_members(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} member(s) deactivated.')


# ─────────────────────────────────────────────
# OPERATING HOURS ADMIN
# ─────────────────────────────────────────────
@admin.register(BranchOperatingHours)
class BranchOperatingHoursAdmin(admin.ModelAdmin):

    list_display  = [
        'branch', 'day', 'open_time',
        'close_time', 'is_closed', 'hours_display',
    ]
    list_filter   = ['is_closed', 'day']
    search_fields = ['branch__name', 'branch__business__name']
    ordering      = ['branch', 'day']
    readonly_fields = ['id']

    @admin.display(description='Hours')
    def hours_display(self, obj):
        if obj.is_closed:
            return format_html(
                '<span style="color:#ef4444;font-weight:bold;">Closed</span>'
            )
        if obj.open_time and obj.close_time:
            return format_html(
                '<span style="color:#22c55e;">{} – {}</span>',
                obj.open_time.strftime('%I:%M %p'),
                obj.close_time.strftime('%I:%M %p'),
            )
        return '—'