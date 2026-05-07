# apps/authentication/admin.py
# AIBMS – BharatSync AI
# Authentication Admin

from django.contrib import admin
from .models import OTPVerification


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):

    list_display = [
        'user',
        'otp_type',
        'otp_code',
        'status',
        'attempts',
        'created_at',
        'expires_at',
    ]

    list_filter = [
        'otp_type',
        'status',
        'created_at',
    ]

    search_fields = [
        'user__email',
        'user__full_name',
        'otp_code',
    ]

    readonly_fields = [
        'id',
        'otp_code',
        'created_at',
    ]

    ordering = ['-created_at']