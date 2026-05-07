# apps/ai_chatbot/serializers.py
# AIBMS – BharatSync AI
# AI Chatbot Serializers — Production-optimised
#
# Key improvements:
#   • ChatSessionListSerializer.message_count reads from DB annotation
#     (set by the view's annotate()) instead of calling obj.messages.count()
#     which would fire an extra SQL query per session row.
#   • get_last_message uses prefetched_last_message when available (set by
#     the QuerySet.with_last_message() method) — zero extra queries.
#   • All read-only fields declared explicitly to prevent accidental writes.

from rest_framework import serializers
from .models import (
    ChatSession,
    ChatMessage,
    KnowledgeBase,
    ChatbotUsageStats,
    SavedChatResponse,
    KnowledgeDomain,
    ChatIntent,
)


# ─────────────────────────────────────────────
# CHAT MESSAGE
# ─────────────────────────────────────────────

class ChatMessageSerializer(serializers.ModelSerializer):

    class Meta:
        model  = ChatMessage
        fields = [
            'id', 'role', 'content',
            'intent', 'domain',
            'model_used', 'tokens_used',
            'processing_time', 'has_data',
            'query_result', 'is_helpful',
            'feedback_note', 'created_at',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# CHAT SESSION LIST
# ─────────────────────────────────────────────

class ChatSessionListSerializer(serializers.ModelSerializer):
    """
    Used in list endpoints. message_count comes from DB annotation set
    by ChatSession.objects.annotate(message_count=Count('messages')).
    Avoids the N+1 query that obj.messages.count() would cause.
    """
    # Source='message_count' reads the annotated field directly from the
    # queryset row — no extra DB hit.
    message_count = serializers.IntegerField(read_only=True, default=0)
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = ChatSession
        fields = [
            'id', 'title', 'business',
            'is_active', 'message_count',
            'last_message', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_last_message(self, obj):
        # Use prefetched list if available (set by with_last_message()) — zero DB hit.
        prefetched = getattr(obj, 'prefetched_last_message', None)
        if prefetched is not None:
            last = prefetched[0] if prefetched else None
        else:
            # Fallback: single extra query per session (only used outside list view)
            last = obj.messages.order_by('-created_at').first()

        if last:
            return {
                'role':       last.role,
                'content':    last.content[:120],
                'created_at': last.created_at,
            }
        return None


# ─────────────────────────────────────────────
# CHAT SESSION DETAIL
# ─────────────────────────────────────────────

class ChatSessionDetailSerializer(serializers.ModelSerializer):
    """
    Used in detail endpoint. Messages are prefetch_related by the view,
    so accessing obj.messages.all() triggers no extra query.
    """
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model  = ChatSession
        fields = [
            'id', 'title', 'business',
            'is_active', 'messages',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# CHAT SESSION CREATE
# ─────────────────────────────────────────────

class ChatSessionCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = ChatSession
        fields = ['id', 'business', 'title']
        read_only_fields = ['id']
        extra_kwargs = {
            'business': {'required': False},
            'title':    {'required': False},
        }


# ─────────────────────────────────────────────
# SEND MESSAGE
# ─────────────────────────────────────────────

class SendMessageSerializer(serializers.Serializer):

    message     = serializers.CharField(max_length=2000)
    business_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message cannot be empty.')
        return value


# ─────────────────────────────────────────────
# QUICK CHAT
# ─────────────────────────────────────────────

class QuickChatSerializer(serializers.Serializer):

    message     = serializers.CharField(max_length=2000)
    business_id = serializers.UUIDField(required=False, allow_null=True)
    session_id  = serializers.UUIDField(required=False, allow_null=True)

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message cannot be empty.')
        return value


# ─────────────────────────────────────────────
# CHAT RESPONSE
# ─────────────────────────────────────────────

class ChatResponseSerializer(serializers.Serializer):

    session_id      = serializers.UUIDField()
    message_id      = serializers.UUIDField()
    response        = serializers.CharField()
    intent          = serializers.ChoiceField(choices=ChatIntent.choices)
    domain          = serializers.ChoiceField(choices=KnowledgeDomain.choices)
    has_data        = serializers.BooleanField()
    query_result    = serializers.DictField()
    processing_time = serializers.FloatField()
    tokens_used     = serializers.IntegerField()


# ─────────────────────────────────────────────
# MESSAGE FEEDBACK
# ─────────────────────────────────────────────

class MessageFeedbackSerializer(serializers.Serializer):

    is_helpful    = serializers.BooleanField()
    feedback_note = serializers.CharField(
        required=False, allow_blank=True, max_length=500,
    )


# ─────────────────────────────────────────────
# KNOWLEDGE BASE
# ─────────────────────────────────────────────

class KnowledgeBaseSerializer(serializers.ModelSerializer):

    class Meta:
        model  = KnowledgeBase
        fields = [
            'id', 'domain', 'question',
            'answer', 'keywords', 'source',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Keywords must be a list.')
        return value


# ─────────────────────────────────────────────
# USAGE STATS
# ─────────────────────────────────────────────

class ChatbotUsageStatsSerializer(serializers.ModelSerializer):

    class Meta:
        model  = ChatbotUsageStats
        fields = [
            'id', 'date',
            'total_messages', 'knowledge_queries',
            'data_queries', 'total_tokens',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# SAVED RESPONSE
# ─────────────────────────────────────────────

class SavedChatResponseSerializer(serializers.ModelSerializer):
    """
    message is select_related by the view, so no extra query per item.
    """
    message = ChatMessageSerializer(read_only=True)

    class Meta:
        model  = SavedChatResponse
        fields = ['id', 'message', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']


# ─────────────────────────────────────────────
# SAVE RESPONSE (input)
# ─────────────────────────────────────────────

class SaveResponseSerializer(serializers.Serializer):

    message_id = serializers.UUIDField()
    note       = serializers.CharField(
        required=False, allow_blank=True, max_length=500,
    )


# ─────────────────────────────────────────────
# DOMAIN LIST
# ─────────────────────────────────────────────

class DomainSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


# ─────────────────────────────────────────────
# SUGGESTED QUESTIONS
# ─────────────────────────────────────────────

class SuggestedQuestionsSerializer(serializers.Serializer):
    domain    = serializers.CharField()
    questions = serializers.ListField(child=serializers.CharField())