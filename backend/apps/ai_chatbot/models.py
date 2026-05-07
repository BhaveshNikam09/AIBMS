# apps/ai_chatbot/models.py
# AIBMS – BharatSync AI  |  AI Chatbot Module
# Optimised: indexes, annotated queries, select_related hints, no N+1 traps.

import uuid
from django.db import models
from django.db.models import Count, Prefetch
from apps.users.models import User
from apps.business.models import Business


# ─────────────────────────────────────────────
# CHOICE CLASSES
# ─────────────────────────────────────────────

class KnowledgeDomain(models.TextChoices):
    ACCOUNTING_STANDARDS       = 'accounting_standards',       'Accounting Standards'
    AUDITING_ASSURANCE         = 'auditing_assurance',         'Auditing & Assurance Standards'
    CORPORATE_LAWS             = 'corporate_laws',             'Corporate Laws & Governance'
    DIRECT_TAXES               = 'direct_taxes',               'Direct Taxes'
    GST_INDIRECT_TAXES         = 'gst_indirect_taxes',         'GST & Indirect Taxes'
    EXPERT_ADVISORY            = 'expert_advisory',            'Expert Advisory & Professional Guidance'
    MEMBERS_STUDENT_SERVICES   = 'members_student_services',   'Members & Student Services'
    SUSTAINABILITY_REPORTING   = 'sustainability_reporting',   'Sustainability Reporting Standards'
    ACTS_REGULATIONS           = 'acts_regulations',           'Acts & Regulations'
    INTERNAL_AUDIT             = 'internal_audit',             'Internal Audit & Management Accounting'
    DIGITAL_ACCOUNTING         = 'digital_accounting',         'Digital Accounting & Assurance'
    ETHICAL_STANDARDS          = 'ethical_standards',          'Ethical Standards'
    FINANCIAL_REPORTING_REVIEW = 'financial_reporting_review', 'Financial Reporting Review'
    INSOLVENCY_VALUATION       = 'insolvency_valuation',       'Insolvency & Valuation'
    PEER_REVIEW                = 'peer_review',                'Peer Review'
    ICAI_JOURNAL               = 'icai_journal',               'ICAI e-Journal Knowledge'
    BUSINESS_DATA              = 'business_data',              'Business Data Query'
    BUSINESS_INSIGHTS          = 'business_insights',          'Business Insights & Analytics'
    ACCESS_MANAGEMENT          = 'access_management',          'Access & Role Management'
    GENERAL                    = 'general',                    'General'


class ChatIntent(models.TextChoices):
    KNOWLEDGE_QUERY  = 'knowledge_query',  'Knowledge Query'
    DATA_QUERY       = 'data_query',       'Data Query'
    WRITE_ACTION     = 'write_action',     'Write Action'
    MANAGE_ACCESS    = 'manage_access',    'Manage Access'
    BUSINESS_INSIGHT = 'business_insight', 'Business Insight'
    REPORT_REQUEST   = 'report_request',   'Report Request'
    CONFIRMATION     = 'confirmation',     'Confirmation'
    TAX_CALCULATION  = 'tax_calculation',  'Tax Calculation'
    GENERAL          = 'general',          'General'


class PendingActionType(models.TextChoices):
    ADD_INCOME    = 'add_income',    'Add Income Entry'
    ADD_EXPENSE   = 'add_expense',   'Add Expense Entry'
    EDIT_ENTRY    = 'edit_entry',    'Edit Entry'
    DELETE_ENTRY  = 'delete_entry',  'Delete Entry'
    GRANT_ACCESS  = 'grant_access',  'Grant Branch Access'
    REVOKE_ACCESS = 'revoke_access', 'Revoke Branch Access'
    CHANGE_ROLE   = 'change_role',   'Change Member Role'
    CALCULATE_TAX = 'calculate_tax', 'Calculate Tax'


# ─────────────────────────────────────────────
# CUSTOM QUERYSETS
# ─────────────────────────────────────────────

class ChatSessionQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def for_user(self, user):
        return self.filter(user=user)

    def with_message_count(self):
        return self.annotate(message_count=Count('messages'))

    def with_last_message(self):
        """Prefetch only the last message per session to avoid per-row subqueries."""
        last_msgs = ChatMessage.objects.order_by('session_id', '-created_at').distinct('session_id')
        return self.prefetch_related(
            Prefetch('messages', queryset=last_msgs, to_attr='prefetched_last_message')
        )


# ─────────────────────────────────────────────
# CHAT SESSION
# ─────────────────────────────────────────────

class ChatSession(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user     = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='chat_sessions',
    )
    business = models.ForeignKey(
        Business, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='chat_sessions',
    )
    title     = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ChatSessionQuerySet.as_manager()

    class Meta:
        db_table            = 'chat_sessions'
        ordering            = ['-updated_at']
        verbose_name        = 'Chat Session'
        verbose_name_plural = 'Chat Sessions'
        # Compound index: most common query pattern — user + active
        indexes = [
            models.Index(fields=['user', 'is_active', '-updated_at'], name='idx_session_user_active'),
            models.Index(fields=['business', 'is_active'], name='idx_session_biz_active'),
        ]

    def __str__(self):
        return f"Session: {self.title or self.id} – {self.user.full_name}"

    # NOTE: Do NOT add message_count / last_message as @property.
    # Properties trigger per-row DB queries (N+1). Use the QuerySet
    # .with_message_count() / .with_last_message() annotations instead.


# ─────────────────────────────────────────────
# CHAT MESSAGE
# ─────────────────────────────────────────────

class ChatMessage(models.Model):

    class Role(models.TextChoices):
        USER      = 'user',      'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM    = 'system',    'System'

    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name='messages',
    )

    role    = models.CharField(max_length=10, choices=Role.choices, db_index=True)
    content = models.TextField()

    intent = models.CharField(
        max_length=20, choices=ChatIntent.choices,
        default=ChatIntent.GENERAL, blank=True,
    )
    domain = models.CharField(
        max_length=30, choices=KnowledgeDomain.choices,
        default=KnowledgeDomain.GENERAL, blank=True,
    )

    model_used      = models.CharField(max_length=50, blank=True)
    tokens_used     = models.PositiveIntegerField(default=0)
    processing_time = models.FloatField(null=True, blank=True)

    # JSON result stored only when has_data=True (avoids storing {} on every row)
    query_result = models.JSONField(default=dict, blank=True)
    has_data     = models.BooleanField(default=False)

    action_taken = models.BooleanField(default=False)
    action_type  = models.CharField(
        max_length=20, choices=PendingActionType.choices, blank=True,
    )

    is_helpful    = models.BooleanField(null=True, blank=True)
    feedback_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        indexes  = [
            # Hot path: load all messages for a session in order
            models.Index(fields=['session', 'created_at'], name='idx_msg_session_time'),
            # Feedback dashboard
            models.Index(fields=['is_helpful'], name='idx_msg_helpful'),
        ]

    def __str__(self):
        return f"[{self.role.upper()}] {self.content[:60]}"


# ─────────────────────────────────────────────
# PENDING ACTION
# ─────────────────────────────────────────────

class PendingAction(models.Model):

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending Confirmation'
        CONFIRMED = 'confirmed', 'Confirmed & Executed'
        CANCELLED = 'cancelled', 'Cancelled'
        EXPIRED   = 'expired',   'Expired'

    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name='pending_actions',
    )
    user    = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='pending_actions',
    )
    business = models.ForeignKey(
        Business, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pending_actions',
    )

    action_type = models.CharField(max_length=20, choices=PendingActionType.choices)
    action_data = models.JSONField(default=dict)
    status      = models.CharField(
        max_length=10, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )

    confirmation_message = models.TextField(blank=True)
    result_message       = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table            = 'chat_pending_actions'
        ordering            = ['-created_at']
        verbose_name        = 'Pending Action'
        verbose_name_plural = 'Pending Actions'
        indexes = [
            # Confirmation lookup (hot path): session + pending status
            models.Index(fields=['session', 'status'], name='idx_pending_session_status'),
            # Fallback lookup: user + status + time
            models.Index(fields=['user', 'status', 'created_at'], name='idx_pending_user_status'),
        ]

    def __str__(self):
        return f"{self.action_type} – {self.status} – {self.user.full_name}"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def expire_if_needed(self) -> bool:
        if self.is_expired and self.status == self.Status.PENDING:
            self.status = self.Status.EXPIRED
            self.save(update_fields=['status'])
            return True
        return False


# ─────────────────────────────────────────────
# KNOWLEDGE BASE
# ─────────────────────────────────────────────

class KnowledgeBase(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    domain   = models.CharField(max_length=30, choices=KnowledgeDomain.choices, db_index=True)
    question = models.TextField()
    answer   = models.TextField()
    keywords = models.JSONField(default=list, blank=True)
    source   = models.CharField(max_length=255, blank=True)
    is_active  = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table            = 'chatbot_knowledge_base'
        ordering            = ['domain', 'question']
        verbose_name        = 'Knowledge Base Entry'
        verbose_name_plural = 'Knowledge Base Entries'
        indexes = [
            models.Index(fields=['domain', 'is_active'], name='idx_kb_domain_active'),
        ]

    def __str__(self):
        return f"[{self.domain}] {self.question[:80]}"


# ─────────────────────────────────────────────
# CHATBOT USAGE STATS
# ─────────────────────────────────────────────

class ChatbotUsageStats(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chatbot_usage')
    business = models.ForeignKey(
        Business, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='chatbot_usage',
    )
    date              = models.DateField(db_index=True)
    total_messages    = models.PositiveIntegerField(default=0)
    knowledge_queries = models.PositiveIntegerField(default=0)
    data_queries      = models.PositiveIntegerField(default=0)
    write_actions     = models.PositiveIntegerField(default=0)
    manage_actions    = models.PositiveIntegerField(default=0)
    total_tokens      = models.PositiveIntegerField(default=0)

    class Meta:
        db_table        = 'chatbot_usage_stats'
        unique_together = ('user', 'business', 'date')
        ordering        = ['-date']
        indexes = [
            models.Index(fields=['user', '-date'], name='idx_usage_user_date'),
        ]

    def __str__(self):
        return f"Usage: {self.user.full_name} – {self.date}"


# ─────────────────────────────────────────────
# SAVED CHAT RESPONSE (Bookmarks)
# ─────────────────────────────────────────────

class SavedChatResponse(models.Model):

    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_responses')
    message = models.ForeignKey(
        ChatMessage, on_delete=models.CASCADE, related_name='saved_by',
    )
    note       = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'saved_chat_responses'
        unique_together = ('user', 'message')
        ordering        = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_saved_user_time'),
        ]

    def __str__(self):
        return f"Saved by {self.user.full_name}"