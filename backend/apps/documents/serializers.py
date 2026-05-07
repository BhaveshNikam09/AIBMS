# Documents serializers
# apps/documents/serializers.py
# AIBMS – BharatSync AI
# Document Serializers

import os
from django.utils import timezone
from rest_framework import serializers

from apps.users.serializers import UserProfileSerializer
from .models import (
    Document,
    DocumentFolder,
    DocumentShare,
    DocumentActivityLog,
    DocumentCategory,
    DocumentStatus,
)


# ─────────────────────────────────────────────
# ALLOWED FILE TYPES
# ─────────────────────────────────────────────
ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'csv', 'txt', 'jpg', 'jpeg', 'png',
    'gif', 'zip', 'rar', 'ppt', 'pptx',
]

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


# ─────────────────────────────────────────────
# DOCUMENT FOLDER SERIALIZER
# ─────────────────────────────────────────────
class DocumentFolderSerializer(serializers.ModelSerializer):

    document_count = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    subfolders = serializers.SerializerMethodField()

    class Meta:
        model  = DocumentFolder
        fields = [
            'id', 'name', 'parent', 'color',
            'is_active', 'document_count',
            'subfolders', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'created_by_name']

    def get_subfolders(self, obj):
        # Only one level deep to avoid deep recursion
        children = obj.subfolders.filter(is_active=True)
        return DocumentFolderSerializer(children, many=True).data

    def validate_name(self, value):
        business = self.context.get('business')
        parent   = self.initial_data.get('parent')
        qs = DocumentFolder.objects.filter(
            business=business,
            name=value,
            parent=parent,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A folder with this name already exists here."
            )
        return value

    def create(self, validated_data):
        business   = self.context['business']
        created_by = self.context['request'].user
        return DocumentFolder.objects.create(
            business=business,
            created_by=created_by,
            **validated_data,
        )


# ─────────────────────────────────────────────
# DOCUMENT UPLOAD SERIALIZER
# ─────────────────────────────────────────────
class DocumentUploadSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Document
        fields = [
            'title', 'description', 'category',
            'folder', 'branch', 'tags',
            'file', 'expiry_date', 'document_date',
            'is_confidential',
        ]
        extra_kwargs = {
            'description':   {'required': False},
            'folder':        {'required': False},
            'branch':        {'required': False},
            'tags':          {'required': False},
            'expiry_date':   {'required': False},
            'document_date': {'required': False},
            'is_confidential': {'required': False},
        }

    def validate_file(self, value):
        # Check file size
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size cannot exceed 25 MB. "
                f"Your file is {value.size / (1024*1024):.1f} MB."
            )

        # Check extension
        ext = os.path.splitext(value.name)[1].lstrip('.').lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"File type '.{ext}' is not allowed. "
                f"Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        return value

    def validate_folder(self, value):
        if value:
            business = self.context.get('business')
            if value.business != business:
                raise serializers.ValidationError(
                    "Folder does not belong to this business."
                )
        return value

    def validate_branch(self, value):
        if value:
            business = self.context.get('business')
            if value.business != business:
                raise serializers.ValidationError(
                    "Branch does not belong to this business."
                )
        return value

    def create(self, validated_data):
        business    = self.context['business']
        uploaded_by = self.context['request'].user
        file        = validated_data.get('file')

        # Extract file metadata
        ext           = os.path.splitext(file.name)[1].lstrip('.').lower()
        file_type     = getattr(file, 'content_type', 'application/octet-stream')

        return Document.objects.create(
            business       = business,
            uploaded_by    = uploaded_by,
            file_name      = file.name,
            file_size      = file.size,
            file_type      = file_type,
            file_extension = ext,
            **validated_data,
        )


# ─────────────────────────────────────────────
# DOCUMENT LIST SERIALIZER (lightweight)
# ─────────────────────────────────────────────
class DocumentListSerializer(serializers.ModelSerializer):

    uploaded_by_name = serializers.CharField(
        source='uploaded_by.full_name', read_only=True
    )
    folder_name  = serializers.CharField(source='folder.name',  read_only=True)
    branch_name  = serializers.CharField(source='branch.name',  read_only=True)
    file_size_display = serializers.ReadOnlyField()
    is_expired   = serializers.ReadOnlyField()

    class Meta:
        model  = Document
        fields = [
            'id', 'title', 'category', 'status',
            'folder_name', 'branch_name',
            'file_name', 'file_extension',
            'file_size_display', 'file_type',
            'is_confidential', 'is_expired',
            'expiry_date', 'document_date',
            'tags', 'uploaded_by_name',
            'created_at',
        ]


# ─────────────────────────────────────────────
# DOCUMENT DETAIL SERIALIZER (full)
# ─────────────────────────────────────────────
class DocumentDetailSerializer(serializers.ModelSerializer):

    uploaded_by  = UserProfileSerializer(read_only=True)
    folder_name  = serializers.CharField(source='folder.name',  read_only=True)
    branch_name  = serializers.CharField(source='branch.name',  read_only=True)
    file_size_display = serializers.ReadOnlyField()
    is_expired   = serializers.ReadOnlyField()

    class Meta:
        model  = Document
        fields = [
            'id', 'title', 'description', 'category', 'status',
            'folder_name', 'branch_name',
            'file', 'file_name', 'file_extension',
            'file_size', 'file_size_display', 'file_type',
            's3_key', 's3_bucket',
            'is_confidential', 'is_expired',
            'expiry_date', 'document_date',
            'tags', 'uploaded_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ─────────────────────────────────────────────
# DOCUMENT UPDATE SERIALIZER
# ─────────────────────────────────────────────
class DocumentUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Document
        fields = [
            'title', 'description', 'category',
            'folder', 'tags', 'expiry_date',
            'document_date', 'is_confidential',
        ]

    def validate(self, attrs):
        if self.instance.status == DocumentStatus.DELETED:
            raise serializers.ValidationError(
                "Cannot update a deleted document."
            )
        return attrs


# ─────────────────────────────────────────────
# DOCUMENT SHARE SERIALIZER
# ─────────────────────────────────────────────
class DocumentShareSerializer(serializers.ModelSerializer):

    shared_with = UserProfileSerializer(read_only=True)
    shared_by   = UserProfileSerializer(read_only=True)

    class Meta:
        model  = DocumentShare
        fields = [
            'id', 'document', 'shared_with',
            'shared_by', 'share_type',
            'expires_at', 'created_at',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────
# SHARE DOCUMENT SERIALIZER
# ─────────────────────────────────────────────
class ShareDocumentSerializer(serializers.Serializer):

    email      = serializers.EmailField()
    share_type = serializers.ChoiceField(
        choices=DocumentShare.ShareType.choices,
        default=DocumentShare.ShareType.VIEW,
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_email(self, value):
        from apps.users.models import User
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                "No user found with this email."
            )

        document = self.context['document']
        if DocumentShare.objects.filter(
            document=document,
            shared_with=user,
        ).exists():
            raise serializers.ValidationError(
                "Document already shared with this user."
            )

        self.context['shared_with_user'] = user
        return value

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError(
                "Expiry date must be in the future."
            )
        return value

    def save(self):
        document    = self.context['document']
        shared_by   = self.context['request'].user
        shared_with = self.context['shared_with_user']

        return DocumentShare.objects.create(
            document    = document,
            shared_with = shared_with,
            shared_by   = shared_by,
            share_type  = self.validated_data['share_type'],
            expires_at  = self.validated_data.get('expires_at'),
        )


# ─────────────────────────────────────────────
# DOCUMENT ACTIVITY LOG SERIALIZER
# ─────────────────────────────────────────────
class DocumentActivityLogSerializer(serializers.ModelSerializer):

    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model  = DocumentActivityLog
        fields = [
            'id', 'action', 'user_name',
            'ip_address', 'metadata', 'timestamp',
        ]
        read_only_fields = fields