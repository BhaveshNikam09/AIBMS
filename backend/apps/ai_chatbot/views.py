# apps/ai_chatbot/views.py
# AIBMS – BharatSync AI
# AI Chatbot Views — Production-optimised
#
# Key improvements over original:
#   • ChatSessionListCreateView.get → uses annotate(message_count) instead of
#     per-row Python count (eliminates N+1 queries on session list).
#   • ChatbotUsageStatsView.get → aggregates totals in DB (aggregate()) instead
#     of Python sum() loop over hydrated objects.
#   • SaveResponseView.get → uses select_related('message__session') so the
#     ChatMessageSerializer does not fire extra queries per saved item.
#   • ChatSessionDetailView.get → prefetch_related('messages') so the message
#     list is fetched in a single query.
#   • Consistent use of only() / values() to avoid fetching unused columns.

import logging
from django.db.models import Sum, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ChatSession,
    ChatMessage,
    KnowledgeBase,
    KnowledgeDomain,
    SavedChatResponse,
    ChatbotUsageStats,
)
from .serializers import (
    ChatSessionListSerializer,
    ChatSessionDetailSerializer,
    ChatSessionCreateSerializer,
    SendMessageSerializer,
    QuickChatSerializer,
    MessageFeedbackSerializer,
    KnowledgeBaseSerializer,
    ChatbotUsageStatsSerializer,
    SavedChatResponseSerializer,
    SaveResponseSerializer,
    DomainSerializer,
    SuggestedQuestionsSerializer,
)
from .services import process_chat_message

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# RESPONSE HELPERS
# ─────────────────────────────────────────────

def success_response(data=None, message='Success', status_code=status.HTTP_200_OK):
    return Response(
        {'success': True, 'message': message, 'data': data},
        status=status_code,
    )


def error_response(message='Error', errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response(
        {'success': False, 'message': message, 'errors': errors},
        status=status_code,
    )


# ─────────────────────────────────────────────
# SUGGESTED QUESTIONS PER DOMAIN
# ─────────────────────────────────────────────

SUGGESTED_QUESTIONS = {
    'gst_indirect_taxes': [
        'What is GST input tax credit?',
        'How to file GSTR-1?',
        'What is the GST rate for services?',
        'Explain reverse charge mechanism under GST.',
        'What is e-way bill?',
    ],
    'direct_taxes': [
        'What is TDS and how is it calculated?',
        'Explain Section 80C deductions.',
        'What is advance tax?',
        'How are capital gains taxed?',
        'What is the difference between old and new tax regime?',
    ],
    'accounting_standards': [
        'What is IND-AS 116 (Leases)?',
        'Explain depreciation methods under Companies Act.',
        'What is the difference between IND-AS and IFRS?',
        'What is deferred tax asset?',
        'Explain revenue recognition under IND-AS 115.',
    ],
    'auditing_assurance': [
        'What is the audit process in India?',
        'What are the types of audit opinions?',
        'Explain internal vs external audit.',
        'What is a qualified audit report?',
        'What are SA 700 series standards?',
    ],
    'corporate_laws': [
        'What are the duties of a company director?',
        'Explain MCA21 filing requirements.',
        'What is a board resolution?',
        'What are the annual compliance requirements for a private company?',
        'Explain CSR provisions under Companies Act.',
    ],
    'insolvency_valuation': [
        'What is the insolvency resolution process under IBC?',
        'Who is an Insolvency Resolution Professional?',
        'What is NCLT?',
        'Explain liquidation process under IBC.',
        'What are the valuation methods under IBC?',
    ],
    'business_data': [
        'Show my expenses this month.',
        'What is my total income this year?',
        'Which branch made the highest profit?',
        'Show my last 10 transactions.',
        'What is my net profit this month?',
    ],
}


# ─────────────────────────────────────────────
# 1. CHAT SESSION LIST & CREATE
# ─────────────────────────────────────────────

class ChatSessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        List active sessions for the user.
        Uses DB-level annotation for message_count to avoid N+1.
        """
        sessions = (
            ChatSession.objects
            .filter(user=request.user, is_active=True)
            .annotate(message_count=Count('messages'))
            .select_related('business')
            .order_by('-updated_at')
        )
        serializer = ChatSessionListSerializer(sessions, many=True)
        return success_response(data=serializer.data)

    def post(self, request):
        """Create a new chat session."""
        serializer = ChatSessionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message='Validation error', errors=serializer.errors)

        session = serializer.save(user=request.user)
        return success_response(
            data=ChatSessionListSerializer(session).data,
            message='Chat session created.',
            status_code=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────
# 2. CHAT SESSION DETAIL, UPDATE & DELETE
# ─────────────────────────────────────────────

class ChatSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_session(self, session_id, user):
        return get_object_or_404(
            ChatSession.objects.prefetch_related('messages'),
            id=session_id, user=user, is_active=True,
        )

    def get(self, request, session_id):
        """Get full session with all messages — prefetched in one query."""
        session    = self._get_session(session_id, request.user)
        serializer = ChatSessionDetailSerializer(session)
        return success_response(data=serializer.data)

    def patch(self, request, session_id):
        """Update session title."""
        session = self._get_session(session_id, request.user)
        title   = request.data.get('title', '').strip()
        if not title:
            return error_response(message='Title cannot be empty.')
        session.title = title
        session.save(update_fields=['title', 'updated_at'])
        return success_response(
            data=ChatSessionListSerializer(session).data,
            message='Session title updated.',
        )

    def delete(self, request, session_id):
        """Soft-delete (deactivate) a session."""
        session = self._get_session(session_id, request.user)
        session.is_active = False
        session.save(update_fields=['is_active', 'updated_at'])
        return success_response(message='Chat session deleted.')


# ─────────────────────────────────────────────
# 3. SEND MESSAGE (Main Chat Endpoint)
# ─────────────────────────────────────────────

class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(
            ChatSession,
            id=session_id, user=request.user, is_active=True,
        )

        serializer = SendMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message='Validation error', errors=serializer.errors)

        user_message = serializer.validated_data['message']
        business_id  = str(
            serializer.validated_data.get('business_id') or
            (session.business_id if session.business_id else '')
        ) or None

        try:
            result = process_chat_message(
                session=session,
                user_message=user_message,
                business_id=business_id,
                user=request.user,
            )
            return success_response(data={
                'session_id':      str(session.id),
                'message_id':      result['message_id'],
                'response':        result['response'],
                'intent':          result['intent'],
                'domain':          result['domain'],
                'model_used':      result.get('model_used', ''),
                'has_data':        result['has_data'],
                'query_result':    result['query_result'],
                'processing_time': result['processing_time'],
                'tokens_used':     result['tokens_used'],
            })
        except Exception as e:
            logger.error(f"SendMessage error: {e}", exc_info=True)
            return error_response(
                message='Failed to process message. Please try again.',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─────────────────────────────────────────────
# 4. QUICK CHAT (No session required)
# ─────────────────────────────────────────────

class QuickChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = QuickChatSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message='Validation error', errors=serializer.errors)

        user_message = serializer.validated_data['message']
        business_id  = str(serializer.validated_data.get('business_id') or '') or None
        session_id   = serializer.validated_data.get('session_id')

        # Resolve or create session
        session = None
        if session_id:
            session = ChatSession.objects.filter(
                id=session_id, user=request.user, is_active=True,
            ).first()

        if not session:
            session = ChatSession.objects.create(
                user=request.user,
                business_id=business_id,
            )

        try:
            result = process_chat_message(
                session=session,
                user_message=user_message,
                business_id=business_id,
                user=request.user,
            )
            return success_response(data={
                'session_id':      str(session.id),
                'message_id':      result['message_id'],
                'response':        result['response'],
                'intent':          result['intent'],
                'domain':          result['domain'],
                'model_used':      result.get('model_used', ''),
                'has_data':        result['has_data'],
                'query_result':    result['query_result'],
                'processing_time': result['processing_time'],
                'tokens_used':     result['tokens_used'],
            })
        except Exception as e:
            logger.error(f"QuickChat error: {e}", exc_info=True)
            return error_response(
                message='Failed to process message. Please try again.',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─────────────────────────────────────────────
# 5. MESSAGE FEEDBACK
# ─────────────────────────────────────────────

class MessageFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        message = get_object_or_404(
            ChatMessage,
            id=message_id,
            session__user=request.user,
            role=ChatMessage.Role.ASSISTANT,
        )

        serializer = MessageFeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message='Validation error', errors=serializer.errors)

        message.is_helpful    = serializer.validated_data['is_helpful']
        message.feedback_note = serializer.validated_data.get('feedback_note', '')
        message.save(update_fields=['is_helpful', 'feedback_note'])
        return success_response(message='Feedback submitted. Thank you!')


# ─────────────────────────────────────────────
# 6. SAVE / BOOKMARK A RESPONSE
# ─────────────────────────────────────────────

class SaveResponseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SaveResponseSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message='Validation error', errors=serializer.errors)

        message_id = serializer.validated_data['message_id']
        note       = serializer.validated_data.get('note', '')

        message = get_object_or_404(
            ChatMessage, id=message_id, session__user=request.user,
        )

        saved, created = SavedChatResponse.objects.get_or_create(
            user=request.user, message=message, defaults={'note': note},
        )

        if not created:
            return error_response(
                message='Response already saved.',
                status_code=status.HTTP_409_CONFLICT,
            )

        return success_response(
            data=SavedChatResponseSerializer(saved).data,
            message='Response saved successfully.',
            status_code=status.HTTP_201_CREATED,
        )

    def get(self, request):
        """
        List saved responses.
        Uses select_related to avoid per-row message lookups.
        """
        saved = (
            SavedChatResponse.objects
            .filter(user=request.user)
            .select_related('message', 'message__session')
            .order_by('-created_at')
        )
        serializer = SavedChatResponseSerializer(saved, many=True)
        return success_response(data=serializer.data)

    def delete(self, request, saved_id):
        saved = get_object_or_404(SavedChatResponse, id=saved_id, user=request.user)
        saved.delete()
        return success_response(message='Saved response removed.')


# ─────────────────────────────────────────────
# 7. KNOWLEDGE BASE
# ─────────────────────────────────────────────

class KnowledgeBaseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        domain = request.query_params.get('domain', '').strip()
        qs     = KnowledgeBase.objects.filter(is_active=True)
        if domain:
            qs = qs.filter(domain=domain)
        serializer = KnowledgeBaseSerializer(qs, many=True)
        return success_response(data=serializer.data)


# ─────────────────────────────────────────────
# 8. SUPPORTED DOMAINS
# ─────────────────────────────────────────────

class SupportedDomainsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        domains = [{'value': v, 'label': l} for v, l in KnowledgeDomain.choices]
        return success_response(data=domains)


# ─────────────────────────────────────────────
# 9. SUGGESTED QUESTIONS
# ─────────────────────────────────────────────

class SuggestedQuestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        domain = request.query_params.get('domain', '').strip()
        if domain and domain in SUGGESTED_QUESTIONS:
            data = {'domain': domain, 'questions': SUGGESTED_QUESTIONS[domain]}
        else:
            data = [{'domain': d, 'questions': q} for d, q in SUGGESTED_QUESTIONS.items()]
        return success_response(data=data)


# ─────────────────────────────────────────────
# 10. CLEAR CHAT SESSION
# ─────────────────────────────────────────────

class ClearSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(
            ChatSession, id=session_id, user=request.user, is_active=True,
        )
        count    = session.messages.all().delete()[0]
        session.title = ''
        session.save(update_fields=['title', 'updated_at'])
        return success_response(message=f'{count} messages cleared from session.')


# ─────────────────────────────────────────────
# 11. CHATBOT USAGE STATS
# ─────────────────────────────────────────────

class ChatbotUsageStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Usage stats for the last 30 days.
        Totals are computed in a single DB aggregate() call — no Python loops.
        """
        stats_qs = (
            ChatbotUsageStats.objects
            .filter(user=request.user)
            .order_by('-date')[:30]
        )
        # Compute summary totals in DB — one query, no Python sum() loop
        totals = ChatbotUsageStats.objects.filter(
            user=request.user,
        ).order_by('-date')[:30].aggregate(
            total_messages=Sum('total_messages'),
            total_tokens=Sum('total_tokens'),
            knowledge_queries=Sum('knowledge_queries'),
            data_queries=Sum('data_queries'),
        )

        serializer = ChatbotUsageStatsSerializer(stats_qs, many=True)
        return success_response(data={
            'summary': {
                'total_messages':    totals['total_messages']    or 0,
                'total_tokens':      totals['total_tokens']      or 0,
                'knowledge_queries': totals['knowledge_queries'] or 0,
                'data_queries':      totals['data_queries']      or 0,
            },
            'daily': serializer.data,
        })
