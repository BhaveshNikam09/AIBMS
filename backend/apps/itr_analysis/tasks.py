# apps/itr_analysis/tasks.py
# AIBMS –AIBMS
# Celery Tasks for ITR Analysis (Google Gemini)

import time
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# HELPER – Extract Text from PDF
# ─────────────────────────────────────────────
def extract_text_from_pdf(file_path):
    """Extract raw text from ITR PDF file."""
    try:
        import PyPDF2
        text = ""
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


# ─────────────────────────────────────────────
# HELPER – Parse Financial Data from Text
# ─────────────────────────────────────────────
def parse_financial_data(text):
    """
    Extract key financial figures from ITR text.
    Uses regex patterns to find common ITR fields.
    """
    import re
    from decimal import Decimal

    def find_amount(patterns, text):
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '').strip()
                try:
                    return Decimal(amount_str)
                except Exception:
                    pass
        return Decimal('0')

    data = {
        'gross_total_income': find_amount([
            r'Gross Total Income[:\s]+([0-9,]+)',
            r'Total Income[:\s]+([0-9,]+)',
        ], text),

        'total_deductions': find_amount([
            r'Total Deductions[:\s]+([0-9,]+)',
            r'Deductions under Chapter VI[:\s]+([0-9,]+)',
        ], text),

        'taxable_income': find_amount([
            r'Taxable Income[:\s]+([0-9,]+)',
            r'Net Taxable Income[:\s]+([0-9,]+)',
        ], text),

        'tax_payable': find_amount([
            r'Tax Payable[:\s]+([0-9,]+)',
            r'Total Tax Payable[:\s]+([0-9,]+)',
        ], text),

        'tax_paid': find_amount([
            r'Tax Paid[:\s]+([0-9,]+)',
            r'Total Tax Paid[:\s]+([0-9,]+)',
        ], text),

        'tds_amount': find_amount([
            r'TDS[:\s]+([0-9,]+)',
            r'Tax Deducted at Source[:\s]+([0-9,]+)',
        ], text),

        'advance_tax': find_amount([
            r'Advance Tax[:\s]+([0-9,]+)',
        ], text),

        'refund_due': find_amount([
            r'Refund[:\s]+([0-9,]+)',
            r'Refund Due[:\s]+([0-9,]+)',
        ], text),

        'salary_income': find_amount([
            r'Salary[:\s]+([0-9,]+)',
            r'Income from Salary[:\s]+([0-9,]+)',
        ], text),

        'business_income': find_amount([
            r'Business Income[:\s]+([0-9,]+)',
            r'Profit and Gains[:\s]+([0-9,]+)',
        ], text),

        'capital_gains': find_amount([
            r'Capital Gains[:\s]+([0-9,]+)',
            r'Short Term Capital[:\s]+([0-9,]+)',
        ], text),

        'other_income': find_amount([
            r'Other Income[:\s]+([0-9,]+)',
            r'Income from Other Sources[:\s]+([0-9,]+)',
        ], text),

        'house_property_income': find_amount([
            r'House Property[:\s]+([0-9,]+)',
            r'Income from House[:\s]+([0-9,]+)',
        ], text),
    }

    # Convert Decimal to float for JSON serialization
    return {k: float(v) for k, v in data.items()}


# ─────────────────────────────────────────────
# HELPER – Generate AI Analysis via Gemini
# ─────────────────────────────────────────────
def generate_ai_analysis(financial_data, itr_text, form_type, assessment_year):
    """Call Google Gemini to analyze ITR data."""
    try:
        from django.conf import settings
        import google.generativeai as genai

        if not settings.GEMINI_API_KEY:
            logger.warning("Gemini API key not configured.")
            return get_fallback_analysis(financial_data)

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')

        prompt = f"""
You are an expert Indian CA (Chartered Accountant) analyzing an ITR filing.

ITR Form Type: {form_type}
Assessment Year: {assessment_year}

Financial Summary:
- Gross Total Income: Rs.{financial_data.get('gross_total_income', 0):,.2f}
- Total Deductions: Rs.{financial_data.get('total_deductions', 0):,.2f}
- Taxable Income: Rs.{financial_data.get('taxable_income', 0):,.2f}
- Tax Payable: Rs.{financial_data.get('tax_payable', 0):,.2f}
- Tax Paid: Rs.{financial_data.get('tax_paid', 0):,.2f}
- TDS: Rs.{financial_data.get('tds_amount', 0):,.2f}
- Refund Due: Rs.{financial_data.get('refund_due', 0):,.2f}

Income Breakdown:
- Salary: Rs.{financial_data.get('salary_income', 0):,.2f}
- Business: Rs.{financial_data.get('business_income', 0):,.2f}
- Capital Gains: Rs.{financial_data.get('capital_gains', 0):,.2f}
- Other Income: Rs.{financial_data.get('other_income', 0):,.2f}

Provide a JSON response with these exact keys:
{{
    "summary": "2-3 sentence plain English summary of the ITR",
    "insights": ["insight 1", "insight 2", "insight 3"],
    "recommendations": ["recommendation 1", "recommendation 2"],
    "tax_saving_tips": ["tip 1", "tip 2", "tip 3"],
    "risk_flags": ["risk 1"] or []
}}

Respond ONLY with valid JSON. No extra text. No markdown backticks.
"""

        response = model.generate_content(prompt)
        import json
        content  = response.text.strip()

        # Strip markdown code blocks if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        content = content.strip()

        return json.loads(content)

    except Exception as e:
        logger.error(f"Gemini analysis error: {e}")
        return get_fallback_analysis(financial_data)


# ─────────────────────────────────────────────
# HELPER – Fallback Analysis
# ─────────────────────────────────────────────
def get_fallback_analysis(financial_data):
    """Return basic analysis when Gemini is unavailable."""
    gross  = float(financial_data.get('gross_total_income', 0))
    deduct = float(financial_data.get('total_deductions', 0))
    tax    = float(financial_data.get('tax_payable', 0))
    refund = float(financial_data.get('refund_due', 0))

    insights = []
    if gross > 0:
        insights.append(f"Total gross income recorded: Rs.{gross:,.2f}")
    if deduct > 0:
        insights.append(f"Total deductions claimed: Rs.{deduct:,.2f}")
    if refund > 0:
        insights.append(f"Refund of Rs.{refund:,.2f} is due")

    return {
        "summary":         f"ITR filed with gross income of Rs.{gross:,.2f} and tax payable of Rs.{tax:,.2f}.",
        "insights":        insights or ["No specific insights available."],
        "recommendations": ["Consult a CA for personalized tax planning advice."],
        "tax_saving_tips": [
            "Maximize Section 80C deductions up to Rs.1.5 lakh.",
            "Consider NPS contributions under Section 80CCD.",
            "Claim HRA exemption if applicable.",
        ],
        "risk_flags": [],
    }


# ─────────────────────────────────────────────
# MAIN CELERY TASK – Process ITR
# ─────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_itr_analysis(self, itr_record_id):
    """
    Async Celery task to:
    1. Extract text from uploaded ITR PDF
    2. Parse financial data using regex
    3. Generate AI analysis via Google Gemini
    4. Save results to ITRAnalysisResult
    """
    from .models import ITRRecord, ITRAnalysisResult, ITRStatus

    start_time = time.time()
    logger.info(f"Starting ITR analysis for record: {itr_record_id}")

    try:
        # ── Step 1: Fetch ITR Record ───────────
        try:
            itr = ITRRecord.objects.get(id=itr_record_id)
        except ITRRecord.DoesNotExist:
            logger.error(f"ITR Record {itr_record_id} not found.")
            return {'status': 'error', 'message': 'ITR record not found.'}

        # ── Step 2: Mark as Processing ─────────
        itr.status         = ITRStatus.PROCESSING
        itr.celery_task_id = self.request.id
        itr.save(update_fields=['status', 'celery_task_id'])

        # ── Step 3: Extract PDF Text ───────────
        file_path = itr.file.path
        logger.info(f"Extracting text from: {file_path}")
        itr_text = extract_text_from_pdf(file_path)

        if not itr_text:
            raise ValueError(
                "Could not extract text from PDF. "
                "File may be scanned or corrupted."
            )

        # ── Step 4: Parse Financial Data ───────
        logger.info("Parsing financial data...")
        financial_data = parse_financial_data(itr_text)

        # ── Step 5: Generate AI Analysis ───────
        logger.info("Generating AI analysis via Gemini...")
        ai_result = generate_ai_analysis(
            financial_data,
            itr_text,
            itr.form_type,
            itr.assessment_year,
        )

        # ── Step 6: Save Analysis Result ───────
        # fd is already float (converted in parse_financial_data)
        fd = financial_data

        ITRAnalysisResult.objects.update_or_create(
            itr_record = itr,
            defaults   = {
                # Financial data
                'gross_total_income':    fd['gross_total_income'],
                'total_deductions':      fd['total_deductions'],
                'taxable_income':        fd['taxable_income'],
                'tax_payable':           fd['tax_payable'],
                'tax_paid':              fd['tax_paid'],
                'refund_due':            fd['refund_due'],
                'tds_amount':            fd['tds_amount'],
                'advance_tax':           fd['advance_tax'],
                'salary_income':         fd['salary_income'],
                'business_income':       fd['business_income'],
                'capital_gains':         fd['capital_gains'],
                'other_income':          fd['other_income'],
                'house_property_income': fd['house_property_income'],
                # AI analysis
                'ai_summary':           ai_result.get('summary', ''),
                'ai_insights':          ai_result.get('insights', []),
                'ai_recommendations':   ai_result.get('recommendations', []),
                'tax_saving_tips':      ai_result.get('tax_saving_tips', []),
                'risk_flags':           ai_result.get('risk_flags', []),
                'raw_extracted_data':   fd,
            }
        )

        # ── Step 7: Mark as Completed ──────────
        processing_time = time.time() - start_time
        itr.status          = ITRStatus.COMPLETED
        itr.processed_at    = timezone.now()
        itr.processing_time = processing_time
        itr.error_message   = ''
        itr.save(update_fields=[
            'status', 'processed_at',
            'processing_time', 'error_message',
        ])

        logger.info(
            f"ITR analysis completed in {processing_time:.2f}s "
            f"for record: {itr_record_id}"
        )
        return {
            'status':          'completed',
            'itr_record_id':   str(itr_record_id),
            'processing_time': processing_time,
        }

    except Exception as exc:
        logger.error(f"ITR analysis failed: {exc}")

        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            try:
                itr = ITRRecord.objects.get(id=itr_record_id)
                itr.status        = ITRStatus.FAILED
                itr.error_message = str(exc)
                itr.save(update_fields=['status', 'error_message'])
            except Exception:
                pass
            return {
                'status':  'failed',
                'message': str(exc),
            }


# ─────────────────────────────────────────────
# CELERY TASK – Answer ITR Query
# ─────────────────────────────────────────────
@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def answer_itr_query(self, query_id):
    """
    Async task to answer a question about an ITR
    using Google Gemini with the analysis context.
    """
    from .models import ITRQuery

    logger.info(f"Answering ITR query: {query_id}")

    try:
        query = ITRQuery.objects.select_related(
            'itr_record__analysis'
        ).get(id=query_id)

        itr    = query.itr_record
        result = getattr(itr, 'analysis', None)

        if not result:
            query.answer      = "ITR analysis is not yet complete. Please wait."
            query.is_answered = True
            query.answered_at = timezone.now()
            query.save()
            return {'status': 'answered'}

        # Build context
        context = f"""
ITR Form: {itr.form_type}, Assessment Year: {itr.assessment_year}
Gross Income: Rs.{result.gross_total_income:,.2f}
Taxable Income: Rs.{result.taxable_income:,.2f}
Tax Payable: Rs.{result.tax_payable:,.2f}
Tax Paid: Rs.{result.tax_paid:,.2f}
Refund Due: Rs.{result.refund_due:,.2f}
AI Summary: {result.ai_summary}
"""

        try:
            from django.conf import settings
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')

            prompt = (
                f"You are an expert Indian CA. Answer the following question "
                f"about an ITR filing clearly and concisely.\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {query.question}"
            )
            response = model.generate_content(prompt)
            answer   = response.text.strip()

        except Exception as e:
            logger.error(f"Gemini query error: {e}")
            answer = (
                "Unable to process your query at this time. "
                "Please try again later or consult a CA."
            )

        query.answer      = answer
        query.is_answered = True
        query.answered_at = timezone.now()
        query.save(update_fields=['answer', 'is_answered', 'answered_at'])

        return {'status': 'answered', 'query_id': str(query_id)}

    except ITRQuery.DoesNotExist:
        logger.error(f"Query {query_id} not found.")
        return {'status': 'error', 'message': 'Query not found.'}

    except Exception as exc:
        logger.error(f"Query answering failed: {exc}")
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {'status': 'failed', 'message': str(exc)}


# ─────────────────────────────────────────────
# CELERY TASK – Generate ITR Comparison
# ─────────────────────────────────────────────
@shared_task
def generate_itr_comparison(comparison_id):
    """Generate AI-powered comparison between two ITR records."""
    from .models import ITRComparison

    logger.info(f"Generating ITR comparison: {comparison_id}")

    try:
        comparison = ITRComparison.objects.select_related(
            'itr_record_1__analysis',
            'itr_record_2__analysis',
        ).get(id=comparison_id)

        r1 = getattr(comparison.itr_record_1, 'analysis', None)
        r2 = getattr(comparison.itr_record_2, 'analysis', None)

        if not r1 or not r2:
            logger.error("One or both ITR records not yet analysed.")
            return {'status': 'error'}

        # Build comparison data
        comparison_data = {
            'year_1': comparison.itr_record_1.assessment_year,
            'year_2': comparison.itr_record_2.assessment_year,
            'gross_income': {
                'year_1': float(r1.gross_total_income),
                'year_2': float(r2.gross_total_income),
                'change': float(r2.gross_total_income - r1.gross_total_income),
            },
            'taxable_income': {
                'year_1': float(r1.taxable_income),
                'year_2': float(r2.taxable_income),
                'change': float(r2.taxable_income - r1.taxable_income),
            },
            'tax_payable': {
                'year_1': float(r1.tax_payable),
                'year_2': float(r2.tax_payable),
                'change': float(r2.tax_payable - r1.tax_payable),
            },
            'refund_due': {
                'year_1': float(r1.refund_due),
                'year_2': float(r2.refund_due),
                'change': float(r2.refund_due - r1.refund_due),
            },
        }

        # AI Summary via Gemini
        try:
            from django.conf import settings
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')

            prompt = f"""
Compare these two ITR filings and provide a brief analysis:
Year 1 ({comparison_data['year_1']}): Income Rs.{comparison_data['gross_income']['year_1']:,.2f}, Tax Rs.{comparison_data['tax_payable']['year_1']:,.2f}
Year 2 ({comparison_data['year_2']}): Income Rs.{comparison_data['gross_income']['year_2']:,.2f}, Tax Rs.{comparison_data['tax_payable']['year_2']:,.2f}

Provide 2-3 sentences comparing the two years highlighting key changes.
"""
            response   = model.generate_content(prompt)
            ai_summary = response.text.strip()

        except Exception:
            change    = comparison_data['gross_income']['change']
            direction = "increased" if change > 0 else "decreased"
            ai_summary = (
                f"Income {direction} by Rs.{abs(change):,.2f} "
                f"between {comparison_data['year_1']} "
                f"and {comparison_data['year_2']}."
            )

        comparison.comparison_data = comparison_data
        comparison.ai_summary      = ai_summary
        comparison.save(update_fields=['comparison_data', 'ai_summary'])

        return {'status': 'completed', 'comparison_id': str(comparison_id)}

    except ITRComparison.DoesNotExist:
        logger.error(f"Comparison {comparison_id} not found.")
        return {'status': 'error', 'message': 'Comparison not found.'}

    except Exception as exc:
        logger.error(f"Comparison failed: {exc}")
        return {'status': 'failed', 'message': str(exc)}
