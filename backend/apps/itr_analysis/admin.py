# apps/itr_analysis/admin.py
# AIBMS –AIBMS
# ITR Analysis Admin Panel Configuration

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    ITRRecord,
    ITRAnalysisResult,
    ITRComparison,
    ITRQuery,
    ITRStatus,
)


# ─────────────────────────────────────────────
# ITR ANALYSIS RESULT INLINE
# ─────────────────────────────────────────────
class ITRAnalysisResultInline(admin.StackedInline):
    model        = ITRAnalysisResult
    can_delete   = False
    verbose_name = 'Analysis Result'
    readonly_fields = [
        'gross_total_income', 'total_deductions',
        'taxable_income', 'tax_payable',
        'tax_paid', 'refund_due',
        'tds_amount', 'advance_tax',
        'salary_income', 'business_income',
        'capital_gains', 'other_income',
        'house_property_income',
        'ai_summary', 'ai_insights',
        'ai_recommendations', 'tax_saving_tips',
        'risk_flags', 'created_at', 'updated_at',
    ]
    fields = [
        # Financial
        ('gross_total_income', 'total_deductions', 'taxable_income'),
        ('tax_payable', 'tax_paid', 'refund_due'),
        ('tds_amount', 'advance_tax'),
        # Income breakdown
        ('salary_income', 'business_income', 'capital_gains'),
        ('other_income', 'house_property_income'),
        # AI
        'ai_summary',
        'ai_insights',
        'ai_recommendations',
        'tax_saving_tips',
        'risk_flags',
        ('created_at', 'updated_at'),
    ]


# ─────────────────────────────────────────────
# ITR QUERY INLINE
# ─────────────────────────────────────────────
class ITRQueryInline(admin.TabularInline):
    model           = ITRQuery
    extra           = 0
    fields          = ['question', 'answer', 'is_answered', 'asked_by', 'created_at']
    readonly_fields = ['answer', 'is_answered', 'asked_by', 'created_at']
    show_change_link = True


# ─────────────────────────────────────────────
# ITR RECORD ADMIN
# ─────────────────────────────────────────────
@admin.register(ITRRecord)
class ITRRecordAdmin(admin.ModelAdmin):

    list_display = [
        'taxpayer_name', 'business', 'form_type',
        'assessment_year', 'pan',
        'status_badge', 'processing_time_display',
        'uploaded_by', 'created_at',
    ]
    list_filter  = [
        'form_type', 'assessment_year',
        'status', 'created_at',
    ]
    search_fields = [
        'taxpayer_name', 'pan',
        'business__name', 'uploaded_by__email',
    ]
    ordering      = ['-created_at']
    readonly_fields = [
        'id', 'celery_task_id', 'processing_time',
        'created_at', 'updated_at', 'processed_at',
        'uploaded_by', 'error_message',
    ]
    date_hierarchy = 'created_at'

    inlines = [ITRAnalysisResultInline, ITRQueryInline]

    fieldsets = (
        ('ITR Details', {
            'fields': (
                'id', 'business', 'form_type',
                'assessment_year', 'financial_year',
                'pan', 'taxpayer_name',
            )
        }),
        ('File', {
            'fields': ('file', 'file_name', 'file_size', 'file_type')
        }),
        ('Processing', {
            'fields': (
                'status', 'celery_task_id',
                'error_message', 'processing_time',
            )
        }),
        ('Meta', {
            'fields': (
                'uploaded_by', 'created_at',
                'updated_at', 'processed_at',
            ),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Status')
    def status_badge(self, obj):
        colors = {
            'pending':    '#f59e0b',
            'processing': '#3b82f6',
            'completed':  '#22c55e',
            'failed':     '#ef4444',
            'reviewed':   '#6366f1',
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;'
            'border-radius:4px;font-size:11px;font-weight:bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='Processing Time')
    def processing_time_display(self, obj):
        if obj.processing_time:
            return format_html(
                '<span style="color:#6366f1;">{:.2f}s</span>',
                obj.processing_time,
            )
        return '—'

    actions = [
        'mark_reviewed',
        'reprocess_selected',
    ]

    @admin.action(description='Mark selected as Reviewed')
    def mark_reviewed(self, request, queryset):
        updated = queryset.filter(
            status=ITRStatus.COMPLETED
        ).update(status=ITRStatus.REVIEWED)
        self.message_user(request, f'{updated} ITR(s) marked as reviewed.')

    @admin.action(description='Reprocess selected ITRs')
    def reprocess_selected(self, request, queryset):
        from .tasks import process_itr_analysis
        count = 0
        for itr in queryset.exclude(status=ITRStatus.PROCESSING):
            itr.status        = ITRStatus.PENDING
            itr.error_message = ''
            itr.save(update_fields=['status', 'error_message'])
            process_itr_analysis.delay(str(itr.id))
            count += 1
        self.message_user(request, f'{count} ITR(s) queued for reprocessing.')


# ─────────────────────────────────────────────
# ITR ANALYSIS RESULT ADMIN
# ─────────────────────────────────────────────
@admin.register(ITRAnalysisResult)
class ITRAnalysisResultAdmin(admin.ModelAdmin):

    list_display = [
        'itr_record', 'gross_total_income',
        'taxable_income', 'tax_payable',
        'refund_due', 'created_at',
    ]
    search_fields = [
        'itr_record__taxpayer_name',
        'itr_record__pan',
        'itr_record__business__name',
    ]
    readonly_fields = [
        'id', 'itr_record', 'created_at', 'updated_at',
        'gross_total_income', 'total_deductions',
        'taxable_income', 'tax_payable',
        'tax_paid', 'refund_due',
        'tds_amount', 'advance_tax',
        'salary_income', 'business_income',
        'capital_gains', 'other_income',
        'house_property_income',
        'ai_summary', 'ai_insights',
        'ai_recommendations', 'tax_saving_tips',
        'risk_flags', 'raw_extracted_data',
    ]
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False

    fieldsets = (
        ('ITR Record', {
            'fields': ('id', 'itr_record')
        }),
        ('Income Summary', {
            'fields': (
                'gross_total_income', 'total_deductions',
                'taxable_income',
            )
        }),
        ('Tax Summary', {
            'fields': (
                'tax_payable', 'tax_paid',
                'tds_amount', 'advance_tax', 'refund_due',
            )
        }),
        ('Income Breakdown', {
            'fields': (
                'salary_income', 'business_income',
                'capital_gains', 'other_income',
                'house_property_income',
            )
        }),
        ('AI Analysis', {
            'fields': (
                'ai_summary', 'ai_insights',
                'ai_recommendations', 'tax_saving_tips',
                'risk_flags',
            )
        }),
        ('Raw Data', {
            'fields': ('raw_extracted_data',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


# ─────────────────────────────────────────────
# ITR COMPARISON ADMIN
# ─────────────────────────────────────────────
@admin.register(ITRComparison)
class ITRComparisonAdmin(admin.ModelAdmin):

    list_display = [
        'business', 'itr_record_1',
        'itr_record_2', 'created_by', 'created_at',
    ]
    search_fields = [
        'business__name',
        'itr_record_1__assessment_year',
        'itr_record_2__assessment_year',
    ]
    readonly_fields = [
        'id', 'comparison_data',
        'ai_summary', 'created_at',
    ]
    ordering = ['-created_at']


# ─────────────────────────────────────────────
# ITR QUERY ADMIN
# ─────────────────────────────────────────────
@admin.register(ITRQuery)
class ITRQueryAdmin(admin.ModelAdmin):

    list_display = [
        'itr_record', 'asked_by',
        'question_preview', 'is_answered',
        'created_at', 'answered_at',
    ]
    list_filter   = ['is_answered', 'created_at']
    search_fields = [
        'question', 'answer',
        'itr_record__taxpayer_name',
        'asked_by__email',
    ]
    readonly_fields = [
        'id', 'itr_record', 'asked_by',
        'question', 'answer',
        'is_answered', 'created_at', 'answered_at',
    ]
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False

    @admin.display(description='Question')
    def question_preview(self, obj):
        preview = obj.question[:60]
        if len(obj.question) > 60:
            preview += '...'
        return preview