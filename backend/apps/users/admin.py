# apps/users/admin.py
# AIBMS – BharatSync AI
# User Admin Panel Configuration

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html

from .models import User, OTP, UserActivityLog


# ─────────────────────────────────────────────
# USER ADMIN
# ─────────────────────────────────────────────
@admin.register(User)
class UserAdmin(BaseUserAdmin):

    # List view
    list_display  = [
        'email', 'full_name', 'role', 'is_active',
        'is_verified', 'created_at', 'profile_badge',
    ]
    list_filter   = ['role', 'is_active', 'is_verified', 'created_at']
    search_fields = ['email', 'full_name', 'phone']
    ordering      = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_login']

    # Detail view fieldsets
    fieldsets = (
        ('Identity', {
            'fields': ('id', 'email', 'phone', 'full_name')
        }),
        ('Role & Status', {
            'fields': ('role', 'is_active', 'is_verified', 'is_staff', 'is_superuser')
        }),
        ('Profile', {
            'fields': ('profile_picture', 'designation', 'date_of_joining')
        }),
        ('Permissions', {
            'fields': ('groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_login'),
            'classes': ('collapse',),
        }),
    )

    # Add user form fieldsets
    add_fieldsets = (
        ('Create New User', {
            'classes': ('wide',),
            'fields': (
                'email', 'full_name', 'phone', 'role',
                'password1', 'password2',
                'is_active', 'is_verified', 'is_staff',
            ),
        }),
    )

    # Custom column: profile badge
    @admin.display(description='Profile')
    def profile_badge(self, obj):
        if obj.profile_picture:
            return format_html(
                '<img src="{}" width="32" height="32" '
                'style="border-radius:50%;" />',
                obj.profile_picture.url,
            )
        initials = obj.full_name[:1].upper() if obj.full_name else '?'
        return format_html(
            '<span style="background:#6366f1;color:white;padding:4px 8px;'
            'border-radius:50%;font-weight:bold;">{}</span>',
            initials,
        )

    # Bulk actions
    actions = ['activate_users', 'deactivate_users', 'mark_verified']

    @admin.action(description='Activate selected users')
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} user(s) activated.')

    @admin.action(description='Deactivate selected users')
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} user(s) deactivated.')

    @admin.action(description='Mark selected users as verified')
    def mark_verified(self, request, queryset):
        updated = queryset.update(is_verified=True)
        self.message_user(request, f'{updated} user(s) marked as verified.')


# ─────────────────────────────────────────────
# OTP ADMIN
# ─────────────────────────────────────────────
@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):

    list_display  = [
        'user', 'purpose', 'code', 'is_used',
        'expires_at', 'created_at', 'status_badge',
    ]
    list_filter   = ['purpose', 'is_used', 'created_at']
    search_fields = ['user__email', 'code']
    readonly_fields = ['id', 'created_at']
    ordering      = ['-created_at']

    @admin.display(description='Status')
    def status_badge(self, obj):
        if obj.is_used:
            return format_html(
                '<span style="color:gray;">Used</span>'
            )
        if obj.is_valid():
            return format_html(
                '<span style="color:green;font-weight:bold;">Valid</span>'
            )
        return format_html(
            '<span style="color:red;">Expired</span>'
        )


# ─────────────────────────────────────────────
# ACTIVITY LOG ADMIN
# ─────────────────────────────────────────────
@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):

    list_display  = [
        'user', 'action', 'ip_address', 'timestamp', 'action_badge',
    ]
    list_filter   = ['action', 'timestamp']
    search_fields = ['user__email', 'ip_address']
    readonly_fields = ['id', 'user', 'action', 'ip_address',
                       'user_agent', 'metadata', 'timestamp']
    ordering      = ['-timestamp']

    # Disable add/delete from admin — logs are read-only
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description='Action')
    def action_badge(self, obj):
        colors = {
            'login':          'green',
            'logout':         'gray',
            'password_reset': 'orange',
            'profile_update': 'blue',
            'failed_login':   'red',
        }
        color = colors.get(obj.action, 'black')
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color,
            obj.get_action_display(),
        )