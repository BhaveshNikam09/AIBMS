# Documents views
# apps/documents/views.py
# AIBMS – BharatSync AI
# Document Management Views

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from utils.response import success_response, error_response
from utils.pagination import StandardPagination
from apps.business.models import Business, BusinessMember

from .models import (
    Document,
    DocumentFolder,
    DocumentShare,
    DocumentActivityLog,
    DocumentStatus,
)
from .serializers import (
    DocumentUploadSerializer,
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentUpdateSerializer,
    DocumentFolderSerializer,
    DocumentShareSerializer,
    ShareDocumentSerializer,
    DocumentActivityLogSerializer,
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


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_document_activity(document, user, action, request, metadata=None):
    DocumentActivityLog.objects.create(
        document   = document,
        user       = user,
        action     = action,
        ip_address = get_client_ip(request),
        metadata   = metadata or {},
    )


def can_access_document(document, user):
    """
    Check if user can access a document.

    FIX: Confidential check was happening BEFORE membership check, which
    locked out even the uploader. Now membership is checked first; only
    non-members are blocked from confidential documents.
    """
    business = document.business

    # Owner and super admin always have access
    if user.is_super_admin or business.owner == user:
        return True

    # The user who uploaded the document always has access
    if document.uploaded_by == user:
        return True

    # Check business membership
    is_member = BusinessMember.objects.filter(
        business=business,
        user=user,
        status=BusinessMember.MemberStatus.ACTIVE,
    ).exists()

    # Members can access non-confidential documents
    if is_member and not document.is_confidential:
        return True

    # Check if document is explicitly shared with this user (valid share)
    share = DocumentShare.objects.filter(
        document=document,
        shared_with=user,
    ).first()
    if share and share.is_valid():
        return True

    return False


# ─────────────────────────────────────────────
# DOCUMENT FOLDERS
# ─────────────────────────────────────────────
class DocumentFolderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        # Only root folders (no parent)
        queryset = DocumentFolder.objects.filter(
            business  = business,
            parent    = None,
            is_active = True,
        )

        serializer = DocumentFolderSerializer(queryset, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        serializer = DocumentFolderSerializer(
            data=request.data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Folder creation failed.",
                errors=serializer.errors,
            )

        folder = serializer.save()
        return success_response(
            data=DocumentFolderSerializer(folder).data,
            message="Folder created successfully.",
            status=201,
        )


class DocumentFolderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, business, pk):
        try:
            return DocumentFolder.objects.get(pk=pk, business=business)
        except DocumentFolder.DoesNotExist:
            return None

    def patch(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        folder = self.get_object(business, pk)
        if not folder:
            return error_response(message="Folder not found.", status=404)

        serializer = DocumentFolderSerializer(
            folder,
            data=request.data,
            partial=True,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(errors=serializer.errors)

        serializer.save()
        return success_response(
            data=serializer.data,
            message="Folder updated successfully.",
        )

    def delete(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        folder = self.get_object(business, pk)
        if not folder:
            return error_response(message="Folder not found.", status=404)

        # Check if folder has documents
        if folder.documents.filter(status=DocumentStatus.ACTIVE).exists():
            return error_response(
                message="Cannot delete folder with active documents. "
                        "Move or delete documents first."
            )

        folder.is_active = False
        folder.save(update_fields=['is_active'])
        return success_response(message="Folder deleted successfully.")


# ─────────────────────────────────────────────
# DOCUMENT LIST & UPLOAD
# ─────────────────────────────────────────────
class DocumentListUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        queryset = Document.objects.filter(
            business=business,
        ).exclude(status=DocumentStatus.DELETED).select_related(
            'folder', 'branch', 'uploaded_by'
        )

        # Hide confidential from non-owners / non-uploaders
        if not (request.user.is_super_admin or business.owner == request.user):
            queryset = queryset.filter(is_confidential=False)

        # ── Filters ───────────────────────────
        category   = request.query_params.get('category')
        status     = request.query_params.get('status')
        folder_id  = request.query_params.get('folder')
        branch_id  = request.query_params.get('branch')
        search     = request.query_params.get('search')
        expiring   = request.query_params.get('expiring_soon')

        if category:
            queryset = queryset.filter(category=category)
        if status:
            queryset = queryset.filter(status=status)
        if folder_id:
            queryset = queryset.filter(folder_id=folder_id)
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if search:
            queryset = queryset.filter(title__icontains=search)
        if expiring:
            from datetime import timedelta
            soon = timezone.now().date() + timedelta(days=30)
            queryset = queryset.filter(
                expiry_date__lte=soon,
                expiry_date__gte=timezone.now().date(),
            )

        paginator  = StandardPagination()
        page       = paginator.paginate_queryset(queryset, request)
        serializer = DocumentListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, business_id):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        # FIX: Normalise the 'name' field sent by the frontend into 'title'.
        # The frontend FormData sends `name` (the raw filename) but the
        # serializer expects `title`. We fall back to the uploaded filename
        # when neither is provided so the field is never empty.
        data = request.data.copy()
        if 'title' not in data or not data['title']:
            data['title'] = (
                data.get('name')
                or (request.FILES.get('file').name if request.FILES.get('file') else '')
                or 'Untitled Document'
            )

        serializer = DocumentUploadSerializer(
            data=data,
            context={'request': request, 'business': business},
        )
        if not serializer.is_valid():
            return error_response(
                message="Document upload failed.",
                errors=serializer.errors,
            )

        document = serializer.save()
        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.UPLOADED,
            request,
        )
        return success_response(
            # FIX: pass request context so FileField renders an absolute URL
            data=DocumentDetailSerializer(document, context={'request': request}).data,
            message="Document uploaded successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# DOCUMENT DETAIL, UPDATE, DELETE
# ─────────────────────────────────────────────
class DocumentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, business, pk):
        try:
            return Document.objects.select_related(
                'folder', 'branch', 'uploaded_by'
            ).get(pk=pk, business=business)
        except Document.DoesNotExist:
            return None

    def get(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        document = self.get_object(business, pk)
        if not document:
            return error_response(message="Document not found.", status=404)

        if not can_access_document(document, request.user):
            return error_response(message="Permission denied.", status=403)

        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.VIEWED,
            request,
        )
        # FIX: pass request context so FileField renders an absolute URL
        return success_response(
            data=DocumentDetailSerializer(document, context={'request': request}).data
        )

    def patch(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        document = self.get_object(business, pk)
        if not document:
            return error_response(message="Document not found.", status=404)

        if not (request.user.is_super_admin or business.owner == request.user
                or document.uploaded_by == request.user):
            return error_response(message="Permission denied.", status=403)

        serializer = DocumentUpdateSerializer(
            document,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return error_response(
                message="Update failed.",
                errors=serializer.errors,
            )

        serializer.save()
        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.UPDATED,
            request,
        )
        # FIX: pass request context so FileField renders an absolute URL
        return success_response(
            data=DocumentDetailSerializer(document, context={'request': request}).data,
            message="Document updated successfully.",
        )

    def delete(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        document = self.get_object(business, pk)
        if not document:
            return error_response(message="Document not found.", status=404)

        if not (request.user.is_super_admin or business.owner == request.user):
            return error_response(message="Permission denied.", status=403)

        document.status = DocumentStatus.DELETED
        document.save(update_fields=['status'])

        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.DELETED,
            request,
        )
        return success_response(message="Document deleted successfully.")


# ─────────────────────────────────────────────
# DOCUMENT ARCHIVE
# ─────────────────────────────────────────────
class DocumentArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            document = Document.objects.get(pk=pk, business=business)
        except Document.DoesNotExist:
            return error_response(message="Document not found.", status=404)

        document.status = DocumentStatus.ARCHIVED
        document.save(update_fields=['status'])

        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.ARCHIVED,
            request,
        )
        return success_response(message="Document archived successfully.")


# ─────────────────────────────────────────────
# DOCUMENT SHARE
# ─────────────────────────────────────────────
class DocumentShareView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            document = Document.objects.get(pk=pk, business=business)
        except Document.DoesNotExist:
            return error_response(message="Document not found.", status=404)

        shares = DocumentShare.objects.filter(
            document=document
        ).select_related('shared_with', 'shared_by')

        serializer = DocumentShareSerializer(shares, many=True)
        return success_response(data=serializer.data)

    def post(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            document = Document.objects.get(pk=pk, business=business)
        except Document.DoesNotExist:
            return error_response(message="Document not found.", status=404)

        serializer = ShareDocumentSerializer(
            data=request.data,
            context={
                'request':  request,
                'document': document,
            },
        )
        if not serializer.is_valid():
            return error_response(
                message="Share failed.",
                errors=serializer.errors,
            )

        share = serializer.save()
        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.SHARED,
            request,
            metadata={'shared_with': share.shared_with.email},
        )
        return success_response(
            data=DocumentShareSerializer(share).data,
            message="Document shared successfully.",
            status=201,
        )


# ─────────────────────────────────────────────
# DOCUMENT ACTIVITY LOG
# ─────────────────────────────────────────────
class DocumentActivityLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, business_id, pk):
        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            document = Document.objects.get(pk=pk, business=business)
        except Document.DoesNotExist:
            return error_response(message="Document not found.", status=404)

        if not (request.user.is_super_admin or business.owner == request.user):
            return error_response(message="Permission denied.", status=403)

        logs = DocumentActivityLog.objects.filter(
            document=document
        ).select_related('user').order_by('-timestamp')

        serializer = DocumentActivityLogSerializer(logs, many=True)
        return success_response(data=serializer.data)


# ─────────────────────────────────────────────
# MY SHARED DOCUMENTS
# ─────────────────────────────────────────────
class MySharedDocumentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shares = DocumentShare.objects.filter(
            shared_with=request.user,
        ).select_related('document', 'shared_by')

        # Filter valid shares only
        valid_shares = [s for s in shares if s.is_valid()]
        documents    = [s.document for s in valid_shares]

        serializer = DocumentListSerializer(documents, many=True)
        return success_response(data=serializer.data)


# ─────────────────────────────────────────────
# DOCUMENT ANALYSE — AI extraction + cashbook
# POST /<business_id>/files/<pk>/analyse/
#
# 1. Reads the document file (PDF/image).
# 2. Sends it to Claude claude-sonnet-4-20250514 for extraction.
# 3. Returns structured fields (vendor, amount, date, GST, etc.).
# 4. If the document is a bill/invoice, optionally creates a
#    CashbookEntry (type=debit, status=pending) automatically.
# ─────────────────────────────────────────────
class DocumentAnalyseView(APIView):
    permission_classes = [IsAuthenticated]

    # Bill/invoice-like categories that should auto-create a cashbook entry
    BILL_CATEGORIES = {'invoice', 'receipt', 'tax', 'bank_statement'}

    def post(self, request, business_id, pk):
        import base64, json, mimetypes, os
        import anthropic

        business, err = get_business_or_error(business_id, request.user)
        if err:
            return err

        try:
            document = Document.objects.select_related(
                'folder', 'branch', 'uploaded_by'
            ).get(pk=pk, business=business)
        except Document.DoesNotExist:
            return error_response(message="Document not found.", status=404)

        if not can_access_document(document, request.user):
            return error_response(message="Permission denied.", status=403)

        # ── Read the file ─────────────────────────────────────────────────
        file_field = document.file
        if not file_field:
            return error_response(message="No file attached to this document.", status=400)

        try:
            file_field.open('rb')
            file_bytes = file_field.read()
            file_field.close()
        except Exception as e:
            return error_response(message=f"Could not read file: {e}", status=500)

        # Determine media type
        ext       = (document.file_extension or '').lower()
        mime_map  = {
            'pdf':  'application/pdf',
            'png':  'image/png',
            'jpg':  'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        media_type = mime_map.get(ext) or document.file_type or 'application/pdf'

        # Only PDF and images are supported by the Claude vision API
        if media_type not in mime_map.values():
            return error_response(
                message=f"File type '{ext}' cannot be analysed. "
                        "Only PDF, PNG, JPG are supported.",
                status=400,
            )

        # ── Call Gemini API ───────────────────────────────────────────────

        system_prompt = (
            "You are a financial document intelligence engine for Indian businesses. "
            "Extract ALL relevant fields from the document and return ONLY a valid JSON object. "
            "No markdown, no explanation — raw JSON only.\n\n"
            "Required fields to extract (use null if not present):\n"
            "  document_type       : string  — e.g. 'invoice', 'receipt', 'bank_statement', 'contract', 'tax', 'other'\n"
            "  is_bill             : boolean — true if this is a payable bill/invoice\n"
            "  vendor_name         : string\n"
            "  vendor_gstin        : string\n"
            "  bill_number         : string\n"
            "  bill_date           : string  — YYYY-MM-DD\n"
            "  due_date            : string  — YYYY-MM-DD\n"
            "  subtotal            : number\n"
            "  tax_amount          : number\n"
            "  total_amount        : number  — the final payable amount in INR\n"
            "  currency            : string  — default 'INR'\n"
            "  payment_mode        : string  — 'cash', 'upi', 'bank_transfer', 'cheque', 'card', or 'other'\n"
            "  payment_status      : string  — 'paid', 'unpaid', 'partial'\n"
            "  line_items          : array   — [{description, quantity, unit_price, amount}]\n"
            "  notes               : string\n"
            "  summary             : string  — A concise summary of the document, especially if it is not a bill\n"
            "  important_information : array   — Array of strings containing key clauses, points, or highlights from the document if it is not a bill\n"
            "  confidence_score    : number  — 0-100, your confidence in the extraction\n"
        )

        try:
            from django.conf import settings
            import google.generativeai as genai

            if not getattr(settings, 'GEMINI_API_KEY', None):
                return error_response(message="AI analysis is not configured.", status=500)

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')

            prompt = f"{system_prompt}\n\nExtract all financial fields from this document and return JSON only."
            response = model.generate_content([
                {"mime_type": media_type, "data": file_bytes},
                prompt
            ])

            raw_text = response.text.strip()
            # Strip any accidental markdown fences
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
            extracted = json.loads(raw_text)
        except json.JSONDecodeError:
            extracted = {"raw_text": raw_text, "confidence_score": 0}
        except Exception as e:
            return error_response(message=f"AI analysis failed: {e}", status=500)

        # ── Auto-create cashbook entry if it's a bill ─────────────────────
        cashbook_entry_id   = None
        cashbook_entry_created = False
        auto_push = request.data.get('push_to_cashbook', False)

        is_bill = extracted.get('is_bill', False)
        total   = extracted.get('total_amount')

        if auto_push and is_bill and total:
            try:
                from apps.cashbook.models import CashbookEntry, PaymentMode
                from decimal import Decimal
                import datetime

                bill_date_str = extracted.get('bill_date') or extracted.get('due_date')
                try:
                    entry_date = datetime.date.fromisoformat(bill_date_str) if bill_date_str else datetime.date.today()
                except ValueError:
                    entry_date = datetime.date.today()

                pay_mode_map = {
                    'cash': PaymentMode.CASH,
                    'upi':  PaymentMode.UPI,
                    'bank_transfer': PaymentMode.BANK_TRANSFER,
                    'cheque': PaymentMode.CHEQUE,
                    'card':   PaymentMode.CARD,
                }
                pay_mode = pay_mode_map.get(
                    (extracted.get('payment_mode') or '').lower(),
                    PaymentMode.CASH,
                )

                entry = CashbookEntry.objects.create(
                    business    = business,
                    branch      = document.branch,
                    type        = 'debit',               # bills are money-out
                    amount      = Decimal(str(total)),
                    payment_mode= pay_mode,
                    party_name  = extracted.get('vendor_name') or '',
                    party_gstin = extracted.get('vendor_gstin') or '',
                    description = f"Bill from {extracted.get('vendor_name') or 'vendor'} — {document.title}",
                    reference_no= extracted.get('bill_number') or '',
                    status      = CashbookEntry.EntryStatus.PENDING,
                    date        = entry_date,
                    created_by  = request.user,
                )
                cashbook_entry_id      = str(entry.id)
                cashbook_entry_created = True
            except Exception as e:
                # Non-fatal — return extracted data even if cashbook push fails
                extracted['_cashbook_error'] = str(e)

        log_document_activity(
            document, request.user,
            DocumentActivityLog.Action.VIEWED,
            request,
            metadata={'action': 'ai_analyse', 'confidence': extracted.get('confidence_score')},
        )

        return success_response(data={
            'extracted':              extracted,
            'is_bill':                is_bill,
            'cashbook_entry_created': cashbook_entry_created,
            'cashbook_entry_id':      cashbook_entry_id,
        })
