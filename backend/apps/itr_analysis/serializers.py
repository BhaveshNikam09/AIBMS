# Itr_Analysis serializers
# apps/itr_analysis/serializers.py
# AIBMS – BharatSync AI
# ITR Analysis Serializers

import os
from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from .models import (
    ITRRecord,
    ITRAnalysisResult,
    ITRComparison,
    ITRQuery,
    ITRFormType,
    AssessmentYear,
    ITRStatus,
)


# ─────────────────────────────────────────────
# ALLOWED FILE TYPES FOR ITR
# ─────────────────────────────────────────────
ALLOWED_ITR_EXTENSIONS = ['pdf', 'xml']
MAX_ITR_FILE_SIZE      = 10 * 1024 * 1024  # 10 MB


# ─────────────────────────────────────────────
# ITR UPLOAD SERIALIZER
# ─────────────────────────────────────────────
class ITRUploadSerializer(serializers.ModelSerializer):

    class Meta:
        model  = ITRRecord
        fields = [
            'form_type', 'assessment_year',
            'financial_year', 'pan',
            'taxpayer_name', 'file',
        ]
        extra_kwargs = {
            'financial_year': {'required': False},
            'pan':            {'required': False},
            'taxpayer_name':  {'required': False},
        }

    def validate_file(self, value):
        # Check size
        if value.size > MAX_ITR_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size cannot exceed 10 MB. "
                f"Your file is {value.size / (1024*1024):.1f} MB."
            )
        # Check extension
        ext = os.path.splitext(value.name)[1].lstrip('.').lower()
        if ext not in ALLOWED_ITR_EXTENSIONS:
            raise serializers.ValidationError(
                f"Only PDF and XML files are allowed for ITR upload."
            )
        return value

    def validate(self, attrs):
        business        = self.context.get('business')
        assessment_year = attrs.get('assessment_year')
        form_type       = attrs.get('form_type')

        # Check for duplicate ITR
        qs = ITRRecord.objects.filter(
            business        = business,
            assessment_year = assessment_year,
            form_type       = form_type,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({
                'assessment_year': (
                    f"An ITR record for {form_type} – {assessment_year} "
                    f"already exists for this business."
                )
            })
        return attrs

    def create(self, validated_data):
        business    = self.context['business']
        uploaded_by = self.context['request'].user
        file        = validated_data.get('file')

        ext       = os.path.splitext(file.name)[1].lstrip('.').lower()
        file_type = getattr(file, 'content_type', 'application/pdf')

        return ITRRecord.objects.create(
            business    = business,
            uploaded_by = uploaded_by,
            file_name   = file.name,
            file_size   = file.size,
            file_type   = file_type,
            **validated_data,
        )


# ─────────────────────────────────────────────
# ITR RECORD LIST SERIALIZER (lightweight)
# ─────────────────────────────────────────────
class ITRRecordListSerializer(serializers.ModelSerializer):

    uploaded_by_name = serializers.CharField(
        source='uploaded_by.full_name', read_only=True
    )
    has_analysis = serializers.SerializerMethodField()

    class Meta:
        model  = ITRRecord
        fields = [
            'id', 'form_type', 'assessment_year',
            'financial_year', 'pan', 'taxpayer_name',
            'file_name', 'file_size', 'status',
            'has_analysis', 'processing_time',
            'uploaded_by_name',
            'created_at', 'processed_at',
        ]

    def get_has_analysis(self, obj):
        return hasattr(obj, 'analysis') and obj.analysis is not None


# ─────────────────────────────────────────────
# ITR ANALYSIS RESULT SERIALIZER
# ─────────────────────────────────────────────
class ITRAnalysisResultSerializer(serializers.ModelSerializer):

    class Meta:
        model  = ITRAnalysisResult
        fields = [
            'id',
            # Financial data
            'gross_total_income', 'total_deductions',
            'taxable_income', 'tax_payable',
            'tax_paid', 'refund_due',
            'tds_amount', 'advance_tax',
            # Income breakdown
            'salary_income', 'business_income',
            'capital_gains', 'other_income',
            'house_property_income',
            # AI analysis
            'ai_summary', 'ai_insights',
            'ai_recommendations', 'tax_saving_tips',
            'risk_flags',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# ITR RECORD DETAIL SERIALIZER (full)
# ─────────────────────────────────────────────
class ITRRecordDetailSerializer(serializers.ModelSerializer):

    uploaded_by  = UserProfileSerializer(read_only=True)
    analysis     = ITRAnalysisResultSerializer(read_only=True)
    has_analysis = serializers.SerializerMethodField()
    celery_task_id = serializers.CharField(read_only=True)

    class Meta:
        model  = ITRRecord
        fields = [
            'id', 'form_type', 'assessment_year',
            'financial_year', 'pan', 'taxpayer_name',
            'file', 'file_name', 'file_size', 'file_type',
            'status', 'celery_task_id',
            'error_message', 'processing_time',
            'has_analysis', 'analysis',
            'uploaded_by',
            'created_at', 'updated_at', 'processed_at',
        ]
        read_only_fields = [
            'id', 'status', 'celery_task_id',
            'error_message', 'processing_time',
            'created_at', 'updated_at', 'processed_at',
        ]

    def get_has_analysis(self, obj):
        return hasattr(obj, 'analysis') and obj.analysis is not None


# ─────────────────────────────────────────────
# ITR COMPARISON SERIALIZER
# ─────────────────────────────────────────────
class ITRComparisonSerializer(serializers.ModelSerializer):

    itr_record_1_info = serializers.SerializerMethodField()
    itr_record_2_info = serializers.SerializerMethodField()
    created_by_name   = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = ITRComparison
        fields = [
            'id',
            'itr_record_1', 'itr_record_1_info',
            'itr_record_2', 'itr_record_2_info',
            'comparison_data', 'ai_summary',
            'created_by_name', 'created_at',
        ]
        read_only_fields = [
            'id', 'comparison_data',
            'ai_summary', 'created_at',
        ]

    def get_itr_record_1_info(self, obj):
        return {
            'id':              str(obj.itr_record_1.id),
            'form_type':       obj.itr_record_1.form_type,
            'assessment_year': obj.itr_record_1.assessment_year,
            'status':          obj.itr_record_1.status,
        }

    def get_itr_record_2_info(self, obj):
        return {
            'id':              str(obj.itr_record_2.id),
            'form_type':       obj.itr_record_2.form_type,
            'assessment_year': obj.itr_record_2.assessment_year,
            'status':          obj.itr_record_2.status,
        }

    def validate(self, attrs):
        business     = self.context.get('business')
        itr_record_1 = attrs.get('itr_record_1')
        itr_record_2 = attrs.get('itr_record_2')

        # Must belong to same business
        if itr_record_1.business != business:
            raise serializers.ValidationError({
                'itr_record_1': "ITR record does not belong to this business."
            })
        if itr_record_2.business != business:
            raise serializers.ValidationError({
                'itr_record_2': "ITR record does not belong to this business."
            })

        # Cannot compare same record
        if itr_record_1 == itr_record_2:
            raise serializers.ValidationError(
                "Cannot compare an ITR record with itself."
            )

        # Both must be completed
        if itr_record_1.status != ITRStatus.COMPLETED:
            raise serializers.ValidationError({
                'itr_record_1': "ITR record 1 analysis is not yet completed."
            })
        if itr_record_2.status != ITRStatus.COMPLETED:
            raise serializers.ValidationError({
                'itr_record_2': "ITR record 2 analysis is not yet completed."
            })

        return attrs

    def create(self, validated_data):
        business   = self.context['business']
        created_by = self.context['request'].user
        return ITRComparison.objects.create(
            business   = business,
            created_by = created_by,
            **validated_data,
        )


# ─────────────────────────────────────────────
# ITR QUERY SERIALIZER
# ─────────────────────────────────────────────
class ITRQuerySerializer(serializers.ModelSerializer):

    asked_by_name = serializers.CharField(
        source='asked_by.full_name', read_only=True
    )

    class Meta:
        model  = ITRQuery
        fields = [
            'id', 'question', 'answer',
            'is_answered', 'asked_by_name',
            'created_at', 'answered_at',
        ]
        read_only_fields = [
            'id', 'answer', 'is_answered',
            'asked_by_name', 'created_at', 'answered_at',
        ]

    def validate_question(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "Question must be at least 10 characters."
            )
        return value.strip()

    def create(self, validated_data):
        itr_record = self.context['itr_record']
        asked_by   = self.context['request'].user
        return ITRQuery.objects.create(
            itr_record = itr_record,
            asked_by   = asked_by,
            **validated_data,
        )


# ─────────────────────────────────────────────
# ITR STATUS SERIALIZER (for polling)
# ─────────────────────────────────────────────
class ITRStatusSerializer(serializers.ModelSerializer):

    has_analysis = serializers.SerializerMethodField()

    class Meta:
        model  = ITRRecord
        fields = [
            'id', 'status', 'error_message',
            'processing_time', 'has_analysis',
            'processed_at',
        ]
        read_only_fields = fields

    def get_has_analysis(self, obj):
        return hasattr(obj, 'analysis') and obj.analysis is not None