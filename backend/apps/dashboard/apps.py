# apps/dashboard/apps.py
# AIBMS – BharatSync AI

from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name               = 'apps.dashboard'
    verbose_name       = 'Business Dashboard'