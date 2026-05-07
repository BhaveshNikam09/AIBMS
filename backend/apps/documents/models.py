# Documents models
# apps/documents/models.py
# AIBMS – BharatSync AI
# Document Management Model

import uuid
from django.db import models
from apps.users.models import User
from apps.business.models import Business
from apps.branches.models import Branch


# ─────────────────────────────────────────────
# DOCUMENT CATEGORY
# ─────────────────────────────────────────────
class DocumentCategory(models.TextChoices):
    INVOICE         = 'invoice',         'Invoice'
    RECEIPT         = 'receipt',         'Receipt'
    CONTRACT        = 'contract',        'Contract'
    TAX             = 'tax',             'Tax Document'
    ITR             = 'itr',             'ITR Document'
    BANK_STATEMENT  = 'bank_statement',  'Bank Statement'
    GSTIN           = 'gstin',           'GSTIN Document'
    PAN             = 'pan',             'PAN Document'
    LICENCE         = 'licence',         'Licence'
    AGREEMENT       = 'agreement',       'Agreement'
    PAYROLL         = 'payroll',         'Payroll'
    OTHER           = 'other',           'Other'


# ─────────────────────────────────────────────
# DOCUMENT STATUS
# ─────────────────────────────────────────────
class DocumentStatus(models.TextChoices):
    ACTIVE    = 'active',    'Active'
    ARCHIVED  = 'archived',  'Archived'
    DELETED   = 'deleted',   'Deleted'
    EXPIRED   = 'expired',   'Expired'


# ─────────────────────────────────────────────
# DOCUMENT FOLDER
# ─────────────────────────────────────────────
class DocumentFolder(models.Model):

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='document_folders',
    )
    name     = models.CharField(max_length=255)
    parent   = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='subfolders',
    )
    color    = models.CharField(max_length=7, default='#6366f1')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_folders',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'document_folders'
        unique_together = ('business', 'name', 'parent')
        ordering        = ['name']

    def __str__(self):
        return f"{self.name} – {self.business.name}"

    @property
    def document_count(self):
        return self.documents.filter(
            status=DocumentStatus.ACTIVE
        ).count()


# ─────────────────────────────────────────────
# DOCUMENT
# ─────────────────────────────────────────────
class Document(models.Model):

    # ── Identity ──────────────────────────────
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    branch   = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents',
    )
    folder   = models.ForeignKey(
        DocumentFolder,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents',
    )

    # ── Document Info ─────────────────────────
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category    = models.CharField(
        max_length=20,
        choices=DocumentCategory.choices,
        default=DocumentCategory.OTHER,
        db_index=True,
    )
    tags        = models.JSONField(default=list, blank=True)

    # ── File Info ─────────────────────────────
    file          = models.FileField(upload_to='documents/%Y/%m/')
    file_name     = models.CharField(max_length=255)
    file_size     = models.PositiveBigIntegerField(
        default=0,
        help_text='File size in bytes',
    )
    file_type     = models.CharField(
        max_length=50,
        blank=True,
        help_text='MIME type e.g. application/pdf',
    )
    file_extension = models.CharField(max_length=10, blank=True)

    # ── S3 Info ───────────────────────────────
    s3_key        = models.CharField(max_length=500, blank=True)
    s3_bucket     = models.CharField(max_length=100, blank=True)

    # ── Status & Dates ────────────────────────
    status      = models.CharField(
        max_length=10,
        choices=DocumentStatus.choices,
        default=DocumentStatus.ACTIVE,
        db_index=True,
    )
    expiry_date = models.DateField(
        null=True, blank=True,
        help_text='Document expiry date (for licences, contracts etc.)',
    )
    document_date = models.DateField(
        null=True, blank=True,
        help_text='Date on the document (invoice date, contract date etc.)',
    )

    # ── Access Control ────────────────────────
    is_confidential = models.BooleanField(
        default=False,
        help_text='Confidential documents visible to owner/admin only',
    )

    # ── Uploaded By ───────────────────────────
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents',
    )

    # ── Timestamps ────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = 'documents'
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'
        ordering  = ['-created_at']
        indexes   = [
            models.Index(fields=['business', 'category']),
            models.Index(fields=['business', 'status']),
            models.Index(fields=['business', 'expiry_date']),
        ]

    def __str__(self):
        return f"{self.title} – {self.business.name}"

    @property
    def file_size_display(self):
        size = self.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"

    @property
    def is_expired(self):
        if self.expiry_date:
            from django.utils import timezone
            return self.expiry_date < timezone.now().date()
        return False


# ─────────────────────────────────────────────
# DOCUMENT SHARE
# ─────────────────────────────────────────────
class DocumentShare(models.Model):

    class ShareType(models.TextChoices):
        VIEW      = 'view',      'View Only'
        DOWNLOAD  = 'download',  'View & Download'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document   = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='shares',
    )
    shared_with = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='shared_documents',
    )
    shared_by  = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='documents_shared_by_me',
    )
    share_type  = models.CharField(
        max_length=10,
        choices=ShareType.choices,
        default=ShareType.VIEW,
    )
    expires_at  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'document_shares'
        unique_together = ('document', 'shared_with')
        ordering        = ['-created_at']

    def __str__(self):
        return f"{self.document.title} → {self.shared_with.full_name}"

    def is_valid(self):
        if self.expires_at:
            from django.utils import timezone
            return self.expires_at > timezone.now()
        return True


# ─────────────────────────────────────────────
# DOCUMENT ACTIVITY LOG
# ─────────────────────────────────────────────
class DocumentActivityLog(models.Model):

    class Action(models.TextChoices):
        UPLOADED   = 'uploaded',   'Uploaded'
        VIEWED     = 'viewed',     'Viewed'
        DOWNLOADED = 'downloaded', 'Downloaded'
        UPDATED    = 'updated',    'Updated'
        DELETED    = 'deleted',    'Deleted'
        SHARED     = 'shared',     'Shared'
        ARCHIVED   = 'archived',   'Archived'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document   = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='activity_logs',
    )
    user       = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='document_activities',
    )
    action     = models.CharField(max_length=20, choices=Action.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata   = models.JSONField(default=dict, blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'document_activity_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} – {self.document.title} by {self.user}"