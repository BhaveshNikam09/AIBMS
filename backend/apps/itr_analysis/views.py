# apps/itr_analysis/views.py
# AIBMS – BharatSync AI
# ITR Analysis Views

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from utils.response import success_response, error_response
from utils.pagination import StandardPagination
from apps.business.models import Business, BusinessMember

from .models import (
    ITRRecord,
    ITRAnalysisResult,
    ITRComparison,
    ITRQuery,
    ITRStatus,
)
from .serializers import (
    ITRUploadSerializer,
    ITRRecordListSerializer,
    ITRRecordDetailSerializer,
    ITRAnalysisResultSerializer,
    ITRComparisonSerializer,
    ITRQuerySerializer,
    ITRStatusSerializer,
)
from .tasks import (
    process_itr_analysis,
    answer_itr_query,
    generate_itr_comparison,
)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_business_or_error(business_id, user):
    try:
        business = Business.objects.get(pk=business_id)
    except Business.DoesNotExist:
        return None, error_response(message="Business not found.", status=404)

    is_member = BusinessMember.objects.filter(
        business=business,
        user=user,
        status=BusinessMember.MemberStatus.ACTIVE,
    ).exists()

    if not (user.is_super_admin or business.owner == user or is_member):
        return None, error_response(message="Permission denied.", status=403)

    return business, None


def get_itr_or_error(business, itr_id):
    try:
        return ITRRecord.objects.select_related(
            'uploaded_by', 'analysis'
        ).get(pk=itr_id, business=business), None
    except ITRRecord.DoesNotExist:
        return None, error_response(message="ITR record not found.", status=404)


# ─────────────────────────────────────────────
# ITR LIST & UPLOAD
# ─────────────────────────────────────────────
class ITRListUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = ITRRecord.objects.filter(
            business=business
        ).select_related('uploaded_by')

        # ── Filters ───────────────────────────
        status          = request.query_params.get('status')
        form_type       = request.query_params.get('form_type')
        assessment_year = request.query_params.get('assessment_year')

        if status:
            queryset = queryset.filter(status=status)
        if form_type:
            queryset = queryset.filter(form_type=form_type)
        if assessment_year:
            queryset = queryset.filter(assessment_year=assessment_year)

        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = ITRRecordListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        serializer = ITRUploadSerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="ITR upload failed.",
                errors=serializer.errors,
            )

        itr = serializer.save()

        # ── Trigger Celery Task ────────────────
        task = process_itr_analysis.delay(str(itr.id))
        itr.celery_task_id = task.id
        itr.save(update_fields=['celery_task_id'])

        return success_response(
            data=ITRRecordDetailSerializer(itr).data,
            message=(
                "ITR uploaded successfully. "
                "Analysis is being processed in the background."
            ),
            status=201,
        )


# ─────────────────────────────────────────────
# ITR DETAIL, UPDATE, DELETE
# ─────────────────────────────────────────────
class ITRDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        return success_response(
            data=ITRRecordDetailSerializer(itr).data
        )

    def delete(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        # Only owner or super admin can delete
        if not (request.user.is_super_admin or business.owner == request.user):
            return error_response(message="Permission denied.", status=403)

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        # Prevent deleting while processing
        if itr.status == ITRStatus.PROCESSING:
            return error_response(
                message="Cannot delete an ITR that is currently being processed."
            )

        itr.delete()
        return success_response(message="ITR record deleted successfully.")


# ─────────────────────────────────────────────
# ITR PROCESSING STATUS (polling endpoint)
# ─────────────────────────────────────────────
class ITRStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        return success_response(
            data=ITRStatusSerializer(itr).data
        )


# ─────────────────────────────────────────────
# ITR ANALYSIS RESULT
# ─────────────────────────────────────────────
class ITRAnalysisResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        if itr.status == ITRStatus.PENDING:
            return error_response(
                message="ITR analysis has not started yet.",
                status=400,
            )

        if itr.status == ITRStatus.PROCESSING:
            return error_response(
                message="ITR analysis is still in progress. Please wait.",
                status=202,
            )

        if itr.status == ITRStatus.FAILED:
            return error_response(
                message=f"ITR analysis failed: {itr.error_message}",
                status=400,
            )

        try:
            analysis = itr.analysis
        except ITRAnalysisResult.DoesNotExist:
            return error_response(
                message="Analysis result not found.",
                status=404,
            )

        return success_response(
            data=ITRAnalysisResultSerializer(analysis).data
        )


# ─────────────────────────────────────────────
# REPROCESS ITR
# ─────────────────────────────────────────────
class ITRReprocessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        if not (request.user.is_super_admin or business.owner == request.user):
            return error_response(message="Permission denied.", status=403)

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        if itr.status == ITRStatus.PROCESSING:
            return error_response(
                message="ITR is already being processed."
            )

        # Reset status and retrigger
        itr.status        = ITRStatus.PENDING
        itr.error_message = ''
        itr.save(update_fields=['status', 'error_message'])

        task = process_itr_analysis.delay(str(itr.id))
        itr.celery_task_id = task.id
        itr.save(update_fields=['celery_task_id'])

        return success_response(
            message="ITR reprocessing started.",
            data={'celery_task_id': task.id},
        )


# ─────────────────────────────────────────────
# ITR COMPARISON
# ─────────────────────────────────────────────
class ITRComparisonListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        comparisons = ITRComparison.objects.filter(
            business=business
        ).select_related(
            'itr_record_1', 'itr_record_2', 'created_by'
        )

        serializer = ITRComparisonSerializer(comparisons, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        serializer = ITRComparisonSerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Comparison creation failed.",
                errors=serializer.errors,
            )

        comparison = serializer.save()

        # Trigger async comparison task
        generate_itr_comparison.delay(str(comparison.id))

        return success_response(
            data=ITRComparisonSerializer(comparison).data,
            message=(
                "Comparison created. "
                "AI summary is being generated in the background."
            ),
            status=201,
        )


# ─────────────────────────────────────────────
# ITR COMPARISON DETAIL
# ─────────────────────────────────────────────
class ITRComparisonDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, comparison_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            comparison = ITRComparison.objects.select_related(
                'itr_record_1', 'itr_record_2', 'created_by'
            ).get(pk=comparison_id, business=business)
        except ITRComparison.DoesNotExist:
            return error_response(message="Comparison not found.", status=404)

        return success_response(
            data=ITRComparisonSerializer(comparison).data
        )

    def delete(self, request, business_id, comparison_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            comparison = ITRComparison.objects.get(
                pk=comparison_id, business=business
            )
        except ITRComparison.DoesNotExist:
            return error_response(message="Comparison not found.", status=404)

        comparison.delete()
        return success_response(message="Comparison deleted successfully.")


# ─────────────────────────────────────────────
# ITR QUERIES
# ─────────────────────────────────────────────
class ITRQueryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        queries = ITRQuery.objects.filter(
            itr_record=itr
        ).select_related('asked_by')

        serializer = ITRQuerySerializer(queries, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id, itr_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        # Must be completed to ask questions
        if itr.status != ITRStatus.COMPLETED:
            return error_response(
                message="ITR analysis must be completed before asking questions.",
                status=400,
            )

        serializer = ITRQuerySerializer(
            data=request.data,
            context={
                'request':    request,
                'itr_record': itr,
            },
        )
        if not serializer.is_valid():
            return error_response(
                message="Query submission failed.",
                errors=serializer.errors,
            )

        query = serializer.save()

        # Trigger async task to answer
        answer_itr_query.delay(str(query.id))

        return success_response(
            data=ITRQuerySerializer(query).data,
            message=(
                "Query submitted. "
                "Answer is being generated in the background."
            ),
            status=201,
        )


# ─────────────────────────────────────────────
# ITR QUERY DETAIL (poll for answer)
# ─────────────────────────────────────────────
class ITRQueryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, itr_id, query_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        itr, err = get_itr_or_error(business, itr_id)
        if err:
            return err

        try:
            query = ITRQuery.objects.get(pk=query_id, itr_record=itr)
        except ITRQuery.DoesNotExist:
            return error_response(message="Query not found.", status=404)

        return success_response(
            data=ITRQuerySerializer(query).data
        )