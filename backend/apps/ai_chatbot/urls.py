# apps/ai_chatbot/urls.py
# AIBMS – BharatSync AI
# AI Chatbot URL Patterns

from django.urls import path
from .views import (
    ChatSessionListCreateView,
    ChatSessionDetailView,
    SendMessageView,
    QuickChatView,
    MessageFeedbackView,
    SaveResponseView,
    KnowledgeBaseListView,
    SupportedDomainsView,
    SuggestedQuestionsView,
    ClearSessionView,
    ChatbotUsageStatsView,
)
from .voice_views import VoiceAssistantView

urlpatterns = [

    # ── Quick Chat (no session needed) ────────
    path(
        'chat/',
        QuickChatView.as_view(),
        name='quick-chat',
    ),

    # ── Sessions ──────────────────────────────
    path(
        'sessions/',
        ChatSessionListCreateView.as_view(),
        name='chat-sessions',
    ),
    path(
        'sessions/<uuid:session_id>/',
        ChatSessionDetailView.as_view(),
        name='chat-session-detail',
    ),
    path(
        'sessions/<uuid:session_id>/send/',
        SendMessageView.as_view(),
        name='chat-send-message',
    ),
    path(
        'sessions/<uuid:session_id>/clear/',
        ClearSessionView.as_view(),
        name='chat-clear-session',
    ),

    # ── Message Feedback ──────────────────────
    path(
        'messages/<uuid:message_id>/feedback/',
        MessageFeedbackView.as_view(),
        name='chat-message-feedback',
    ),

    # ── Saved Responses ───────────────────────
    path(
        'saved/',
        SaveResponseView.as_view(),
        name='chat-saved-responses',
    ),
    path(
        'saved/<uuid:saved_id>/delete/',
        SaveResponseView.as_view(),
        name='chat-saved-response-delete',
    ),

    # ── Knowledge Base ────────────────────────
    path(
        'knowledge/',
        KnowledgeBaseListView.as_view(),
        name='chat-knowledge-base',
    ),

    # ── Domains & Suggestions ─────────────────
    path(
        'domains/',
        SupportedDomainsView.as_view(),
        name='chat-domains',
    ),
    path(
        'suggestions/',
        SuggestedQuestionsView.as_view(),
        name='chat-suggestions',
    ),

    # ── Usage Stats ───────────────────────────
    path(
        'stats/',
        ChatbotUsageStatsView.as_view(),
        name='chat-stats',
    ),

    # â”€â”€ Voice Assistant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    path(
        'voice/',
        VoiceAssistantView.as_view(),
        name='chat-voice-assistant',
    ),
]
