# apps/itr_analysis/models.py
# AIBMS – BharatSync AI
# ITR Analysis Module

import uuid
from django.db import models
from apps.users.models import User
from apps.business.models import Business


# ─────────────────────────────────────────────
# ITR FORM TYPES
# ─────────────────────────────────────────────
class ITRFormType(models.TextChoices):
    ITR_1  = 'ITR-1',  'ITR-1 (Sahaj)'
    ITR_2  = 'ITR-2',  'ITR-2'
    ITR_3  = 'ITR-3',  'ITR-3'
    ITR_4  = 'ITR-4',  'ITR-4 (Sugam)'
    ITR_5  = 'ITR-5',  'ITR-5'
    ITR_6  = 'ITR-6',  'ITR-6'
    ITR_7  = 'ITR-7',  'ITR-7'


# ─────────────────────────────────────────────
# ASSESSMENT YEAR
# ─────────────────────────────────────────────
class AssessmentYear(models.TextChoices):
    AY_2021_22 = '2021-22', 'AY 2021-22'
    AY_2022_23 = '2022-23', 'AY 2022-23'
    AY_2023_24 = '2023-24', 'AY 2023-24'
    AY_2024_25 = '2024-25', 'AY 2024-25'
    AY_2025_26 = '2025-26', 'AY 2025-26'


# ─────────────────────────────────────────────
# ITR FILING STATUS
# ─────────────────────────────────────────────
class ITRStatus(models.TextChoices):
    PENDING    = 'pending',    'Pending'
    PROCESSING = 'processing', 'Processing'
    COMPLETED  = 'completed',  'Completed'
    FAILED     = 'failed',     'Failed'
    REVIEWED   = 'reviewed',   'Reviewed'


# ─────────────────────────────────────────────
# ITR RECORD
# ─────────────────────────────────────────────
class ITRRecord(models.Model):

    # ── Identity ──────────────────────────────
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='itr_records',
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_itrs',
    )

    # ── ITR Details ───────────────────────────
    form_type       = models.CharField(
        max_length=10,
        choices=ITRFormType.choices,
    )
    assessment_year = models.CharField(
        max_length=10,
        choices=AssessmentYear.choices,
        db_index=True,
    )
    financial_year  = models.CharField(
        max_length=10,
        blank=True,
        help_text='e.g. 2024-25',
    )
    pan             = models.CharField(max_length=10, blank=True)
    taxpayer_name   = models.CharField(max_length=255, blank=True)

    # ── File ──────────────────────────────────
    file          = models.FileField(upload_to='itr/%Y/%m/')
    file_name     = models.CharField(max_length=255)
    file_size     = models.PositiveBigIntegerField(default=0)
    file_type     = models.CharField(max_length=50, blank=True)

    # ── Processing Status ─────────────────────
    status          = models.CharField(
        max_length=15,
        choices=ITRStatus.choices,
        default=ITRStatus.PENDING,
        db_index=True,
    )
    celery_task_id  = models.CharField(max_length=255, blank=True)
    error_message   = models.TextField(blank=True)
    processing_time = models.FloatField(
        null=True, blank=True,
        help_text='Processing time in seconds',
    )

    # ── Timestamps ────────────────────────────
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table        = 'itr_records'
        verbose_name    = 'ITR Record'
        verbose_name_plural = 'ITR Records'
        ordering        = ['-created_at']
        unique_together = ('business', 'assessment_year', 'form_type')

    def __str__(self):
        return f"{self.form_type} – {self.assessment_year} – {self.business.name}"


# ─────────────────────────────────────────────
# ITR ANALYSIS RESULT
# ─────────────────────────────────────────────
class ITRAnalysisResult(models.Model):

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    itr_record = models.OneToOneField(
        ITRRecord,
        on_delete=models.CASCADE,
        related_name='analysis',
    )

    # ── Extracted Financial Data ──────────────
    gross_total_income    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_deductions      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    taxable_income        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_payable           = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_paid              = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    refund_due            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tds_amount            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    advance_tax           = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # ── Income Breakdown ──────────────────────
    salary_income         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    business_income       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    capital_gains         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    other_income          = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    house_property_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # ── AI Analysis ───────────────────────────
    ai_summary        = models.TextField(blank=True)
    ai_insights       = models.JSONField(default=list, blank=True)
    ai_recommendations = models.JSONField(default=list, blank=True)
    tax_saving_tips   = models.JSONField(default=list, blank=True)
    risk_flags        = models.JSONField(default=list, blank=True)

    # ── Raw Extracted Data ────────────────────
    raw_extracted_data = models.JSONField(
        default=dict, blank=True,
        help_text='Complete raw data extracted from ITR document',
    )

    # ── Timestamps ────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'itr_analysis_results'

    def __str__(self):
        return f"Analysis – {self.itr_record}"


# ─────────────────────────────────────────────
# ITR COMPARISON
# ─────────────────────────────────────────────
class ITRComparison(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='itr_comparisons',
    )
    itr_record_1 = models.ForeignKey(
        ITRRecord,
        on_delete=models.CASCADE,
        related_name='comparisons_as_first',
    )
    itr_record_2 = models.ForeignKey(
        ITRRecord,
        on_delete=models.CASCADE,
        related_name='comparisons_as_second',
    )

    # ── Comparison Result ─────────────────────
    comparison_data  = models.JSONField(default=dict, blank=True)
    ai_summary       = models.TextField(blank=True)
    created_by       = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='itr_comparisons',
    )
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'itr_comparisons'
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"Comparison: {self.itr_record_1.assessment_year} vs "
            f"{self.itr_record_2.assessment_year} – {self.business.name}"
        )


# ─────────────────────────────────────────────
# ITR QUERY (Questions asked about an ITR)
# ─────────────────────────────────────────────
class ITRQuery(models.Model):

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    itr_record = models.ForeignKey(
        ITRRecord,
        on_delete=models.CASCADE,
        related_name='queries',
    )
    asked_by   = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='itr_queries',
    )
    question   = models.TextField()
    answer     = models.TextField(blank=True)
    is_answered = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'itr_queries'
        ordering = ['-created_at']

    def __str__(self):
        return f"Query on {self.itr_record} by {self.asked_by}"