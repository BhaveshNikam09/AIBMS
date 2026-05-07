from __future__ import annotations

import logging
import re
import tempfile
import time
import uuid
from datetime import date
from pathlib import Path
from typing import Iterable

import requests
from django.conf import settings
from django.db.models import Case, Count, DecimalField, Q, Sum, When
from django.utils import timezone

from apps.cashbook.models import CashbookEntry, TransactionType
from .models import ChatSession, ChatIntent, ChatMessage, KnowledgeDomain
from .services import process_chat_message

logger = logging.getLogger(__name__)

VOICE_AUDIO_DIR = Path(getattr(settings, "BASE_DIR", Path("."))) / "static" / "voice_replies"
VOICE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_VOICE_ID = getattr(settings, "MURF_VOICE_ID", "Anisha")
DEFAULT_VOICE_STYLE = getattr(settings, "MURF_VOICE_STYLE", "Conversation")
DEFAULT_VOICE_MODEL = getattr(settings, "MURF_VOICE_MODEL", "FALCON")
VOICE_SPEECH_MAX_CHARS = 360
ASSEMBLYAI_UPLOAD_TIMEOUT = 60
ASSEMBLYAI_TRANSCRIPT_TIMEOUT = 30
ASSEMBLYAI_TOTAL_TIMEOUT = 45
ASSEMBLYAI_POLL_INTERVAL = 0.5
MURF_REQUEST_TIMEOUT = 45
MURF_AUDIO_TEXT_LIMIT = 900

WAKE_PREFIXES = (
    "hey buddy",
    "hi buddy",
    "hello buddy",
    "hey jarvis",
    "hey aibms",
    "buddy",
    "jarvis",
)

BRIEFING_PHRASES = (
    "good morning",
    "good afternoon",
    "good evening",
    "brief me",
    "briefing",
    "status update",
    "dashboard update",
    "what is my status",
    "give me a briefing",
)

SUMMARY_PHRASES = (
    "total profit",
    "net profit",
    "current profit",
    "business performance",
    "how is my business",
    "show my income",
    "show my expenses",
    "income this month",
    "expenses this month",
    "profit this month",
    "monthly profit",
    "month to date",
    "current month",
    "this month",
    "current income",
    "current expense",
    "loss this month",
    "what is my profit",
)

BRANCH_PHRASES = (
    "branch with highest profit",
    "highest profit branch",
    "which branch has the highest profit",
    "best branch",
    "branch wise profit",
    "branch-wise profit",
    "branchwise profit",
    "branch performance",
    "branch profit",
)

DUE_PHRASES = (
    "payable",
    "receivable",
    "pending dues",
    "pending due",
    "dues",
    "who owes",
    "who should pay",
    "who is pay",
    "whom to pay",
    "who has to pay",
    "who needs to pay",
    "pending payments",
)

# ── Voice CRUD constants ──────────────────────────────────────────────────────
AMOUNT_RE = re.compile(
    r'(?:rs\.?|inr|₹)?\s*(\d+(?:[,\d]*)?(?:\.\d+)?)\s*(?:rs\.?|inr|rupees?)?',
    re.IGNORECASE,
)

PAYMENT_MAP = {
    'gpay': 'upi', 'google pay': 'upi', 'phonepe': 'upi',
    'paytm': 'upi', 'upi': 'upi',
    'cash': 'cash',
    'card': 'card', 'credit card': 'card', 'debit card': 'card',
    'net banking': 'bank_transfer', 'netbanking': 'bank_transfer',
    'neft': 'bank_transfer', 'rtgs': 'bank_transfer', 'imps': 'bank_transfer',
    'bank transfer': 'bank_transfer',
    'cheque': 'cheque', 'check': 'cheque',
}

INCOME_SIGNALS = frozenset([
    'income', 'received', 'receive', 'receivable', 'credit', 'sale', 'sales',
    'earned', 'earning', 'revenue', 'got', 'mila', 'aaya', 'aai',
    'receipt', 'inflow', 'gain',
])

BRANCH_CRUD_PHRASES = (
    'create branch', 'add branch', 'new branch', 'open branch', 'set up branch',
    'list branches', 'show branches', 'view branches', 'all branches',
    'show all branches', 'delete branch', 'remove branch', 'close branch',
)

ENTRY_TRIGGER_RE = re.compile(
    r'\b(?:add|record|enter|create|log|book|save|note|daalo|likho|paid|pay|received|receive|payable|receivable|expense|income|spent|spend)\b',
    re.IGNORECASE,
)

SUMMARY_DOMAIN = KnowledgeDomain.BUSINESS_DATA
INSIGHT_DOMAIN = KnowledgeDomain.BUSINESS_INSIGHTS


def _voice_intent_choice(value: str) -> str:
    normalized = str(value or "").strip()
    if normalized in ChatIntent.values:
        return normalized
    if normalized == "business_summary":
        return ChatIntent.DATA_QUERY
    if normalized == "branch_summary":
        return ChatIntent.DATA_QUERY
    if normalized == "due_summary":
        return ChatIntent.DATA_QUERY
    if normalized == "briefing":
        return ChatIntent.BUSINESS_INSIGHT
    if normalized == "chat":
        return ChatIntent.GENERAL
    return ChatIntent.GENERAL


def _voice_domain_choice(value: str) -> str:
    normalized = str(value or "").strip()
    if normalized in KnowledgeDomain.values:
        return normalized
    if normalized in {"business_summary", "branch_summary", "due_summary"}:
        return SUMMARY_DOMAIN
    if normalized == "briefing":
        return INSIGHT_DOMAIN
    if normalized == "chat":
        return KnowledgeDomain.GENERAL
    return KnowledgeDomain.GENERAL


def _greeting_for_now(now: timezone.datetime | None = None) -> str:
    current = now or timezone.localtime(timezone.now())
    hour = current.hour
    if hour < 12:
        return "Good morning"
    if hour < 17:
        return "Good afternoon"
    return "Good evening"


def _format_amount(value) -> str:
    try:
        amount = float(value or 0)
    except Exception:
        amount = 0.0
    if abs(amount - round(amount)) < 0.005:
        return f"₹{int(round(amount)):,.0f}"
    return f"₹{amount:,.2f}"


def _voice_currency_to_words(text: str) -> str:
    def repl(match: re.Match) -> str:
        amount = match.group(1).replace(",", "")
        if amount.endswith(".00"):
            amount = amount[:-3]
        return f"{amount} rupees"

    cleaned = str(text or "")
    cleaned = re.sub(r"₹\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned)
    cleaned = re.sub(r"\bINR\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bRs\.?\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("₹", " rupees ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _format_date(value) -> str:
    if not value:
        return "unknown date"
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%d %b")
        except Exception:
            return str(value)
    return str(value)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def strip_wake_phrase(text: str) -> tuple[str, bool]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return "", False

    wake_seen = False
    for prefix in WAKE_PREFIXES:
        if cleaned.startswith(prefix):
            wake_seen = True
            cleaned = cleaned[len(prefix):].strip(" ,.!?;:-")
            break

    return re.sub(r"\s+", " ", cleaned).strip(), wake_seen


def classify_voice_request(text: str) -> str:
    cleaned = _normalize_text(text)
    if not cleaned:
        return "briefing"

    # CRUD: entry write — must come BEFORE summary phrases
    if ENTRY_TRIGGER_RE.search(cleaned) and AMOUNT_RE.search(cleaned):
        return "add_entry"

    # CRUD: branch management
    if any(phrase in cleaned for phrase in BRANCH_CRUD_PHRASES):
        return "branch_crud"

    if any(phrase in cleaned for phrase in DUE_PHRASES):
        return "due_summary"
    if any(phrase in cleaned for phrase in BRANCH_PHRASES):
        return "branch_summary"
    if any(phrase in cleaned for phrase in SUMMARY_PHRASES):
        return "business_summary"
    if any(phrase in cleaned for phrase in BRIEFING_PHRASES):
        return "briefing"
    return "chat"


# ─────────────────────────────────────────────────────────────────────────────
# VOICE ENTRY PARSER
# ─────────────────────────────────────────────────────────────────────────────
def _extract_voice_amount(text: str) -> float | None:
    text = re.sub(r'(\d),(\d)', r'\1\2', text.lower())
    
    word_to_num = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
    }
    for word, num in word_to_num.items():
        text = re.sub(rf'\b{word}\b', num, text)

    pattern = r'(\d+(?:\.\d+)?)\s*(lakhs?|crores?|thousands?|hundreds?|k|m|cr|b)?'
    multipliers = {
        'lakh': 100000, 'lakhs': 100000,
        'crore': 10000000, 'crores': 10000000, 'cr': 10000000,
        'thousand': 1000, 'thousands': 1000, 'k': 1000,
        'hundred': 100, 'hundreds': 100,
        'million': 1000000, 'm': 1000000,
        'billion': 1000000000, 'b': 1000000000
    }
    
    matches = list(re.finditer(pattern, text))
    if not matches:
        return None
        
    total = 0.0
    last_end = -1
    
    for i, match in enumerate(matches):
        val_str, mult = match.groups()
        val = float(val_str)
        if mult:
            val *= multipliers.get(mult, 1)
        
        if i == 0:
            total += val
            last_end = match.end()
        else:
            between = text[last_end:match.start()].strip()
            if not between or between == 'and':
                total += val
                last_end = match.end()
            else:
                break
                
    return total if total > 0 else None


def parse_voice_entry(text: str, business_id: str | None = None) -> dict:
    """
    Parse a natural-language voice command into cashbook entry fields.
    Example: "add 500 fuel expense by upi at nashik branch"
    Returns: {amount, entry_type, payment_mode, branch_name, description, category}
    """
    lower = _normalize_text(text)

    # 1. Extract amount
    amount = _extract_voice_amount(lower)

    # 2. Transaction type
    entry_type = 'debit'  # default = expense
    if re.search(r'\b(?:' + '|'.join(INCOME_SIGNALS) + r')\b', lower, re.IGNORECASE):
        entry_type = 'credit'

    # 3. Payment mode (longest match first)
    payment_mode = 'cash'
    for kw in sorted(PAYMENT_MAP, key=len, reverse=True):
        if kw in lower:
            payment_mode = PAYMENT_MAP[kw]
            break

    # 4. Branch name — try explicit patterns first, then fuzzy DB lookup
    branch_name = None
    _STOP = {'the', 'a', 'my', 'this', 'that', 'head', 'main'}

    # 4a. Explicit patterns: "at X branch" / "in X branch" / "X branch"
    for pat in [
        r'\bat\s+([\w\s]+?)\s+branch\b',
        r'\bin\s+([\w\s]+?)\s+branch\b',
        r'\b([\w\s]+?)\s+branch\b',
    ]:
        m = re.search(pat, lower)
        if m:
            candidate = m.group(1).strip()
            if candidate not in _STOP:
                branch_name = candidate.title()
                break

    # 4b. Fuzzy DB lookup — check each word/bigram in the voice text against real branch names
    if not branch_name and business_id:
        try:
            from apps.branches.models import Branch
            db_branches = list(
                Branch.objects.filter(business_id=business_id, is_active=True)
                .exclude(branch_type='head_office')
                .exclude(is_primary=True)
                .values_list('name', 'city')
            )
            words = lower.split()
            # Check single words and adjacent pairs against branch name/city
            candidates = words + [' '.join(words[i:i+2]) for i in range(len(words)-1)]
            for candidate in candidates:
                if len(candidate) < 3 or candidate in _STOP:
                    continue
                for (bname, bcity) in db_branches:
                    if (bname and candidate.lower() in bname.lower()) or \
                       (bcity and candidate.lower() in bcity.lower()):
                        branch_name = candidate.title()
                        break
                if branch_name:
                    break
        except Exception:
            pass

    # 5. Clean description — remove noise words (use `noise` not `pat`!)
    desc = lower
    desc = AMOUNT_RE.sub('', desc)
    for noise in [
        r'\b(?:add|record|enter|create|log|book|save|note(?:\s+down)?)\b',
        r'\b(?:expense|income|payment|received|paid|by|via|through|for|of|the|a|an)\b',
        r'\b(?:rs|inr|rupees?|upi|cash|card|cheque|gpay|phonepe|paytm|netbanking)\b',
        r'\b(?:lakhs?|crores?|thousands?|hundreds?|k|m|cr)\b',
        r'\b(?:net\s+banking|bank\s+transfer|credit\s+card|debit\s+card|google\s+pay)\b',
        r'\bat\s+[\w\s]+?\s+branch\b',
        r'\bin\s+[\w\s]+?\s+branch\b',
        r'\b[\w\s]+?\s+branch\b',
    ]:
        desc = re.sub(noise, '', desc, flags=re.IGNORECASE)
    desc = ' '.join(desc.split()).strip()
    raw_desc = desc.title() if desc else 'Voice Entry'

    from .services import detect_category
    tx_type_str = 'income' if entry_type == 'credit' else 'expense'
    category = detect_category(raw_desc, tx_type_str)

    mode_label = {
        'upi': 'UPI', 'cash': 'Cash', 'card': 'Card',
        'bank_transfer': 'Bank Transfer', 'cheque': 'Cheque'
    }.get(payment_mode, payment_mode.title())

    description = f"{category} {tx_type_str} via {mode_label}"

    status = 'pending' if re.search(r'\b(?:payable|receivable|due|pending|to\s+pay|to\s+receive)\b', lower, re.IGNORECASE) else 'confirmed'

    return {
        'amount': amount,
        'entry_type': entry_type,
        'payment_mode': payment_mode,
        'branch_name': branch_name,
        'description': description,
        'category': category,
        'status': status,
    }


# ─────────────────────────────────────────────────────────────────────────────
# VOICE: ADD CASHBOOK ENTRY
# ─────────────────────────────────────────────────────────────────────────────
def build_add_entry_payload(
    user,
    business,
    business_id: str,
    text: str,
    parsed: dict | None = None,
) -> dict:
    from apps.cashbook.models import CashbookEntry, TransactionCategory, PaymentMode
    from apps.branches.models import Branch
    from .services import detect_category

    if parsed is None:
        parsed = parse_voice_entry(text, business_id=business_id)

    if not parsed['amount']:
        speech = 'I could not detect an amount. Please say the amount clearly, for example: add five hundred rupees fuel expense by UPI at Nashik branch.'
        return {
            'intent': ChatIntent.WRITE_ACTION, 'domain': KnowledgeDomain.BUSINESS_DATA,
            'response_text': speech, 'speech_text': speech,
            'has_data': False, 'query_result': {},
        }

    # ── Branch Resolution ─────────────────────────────────────────────────────
    def _resolve_branch(query: str):
        """
        Safe fuzzy resolver — never matches description words against branch names.
        Strategies (in order):
          1. Exact branch name match
          2. Branch name contains the full query
          3. Branch city contains the full query
          4. Branch name starts with the full query
        Returns Branch or None.
        """
        if not query:
            return None
        q = query.strip().lower()
        active = Branch.objects.filter(business_id=business_id, is_active=True)
        b = active.filter(name__iexact=q).first()
        if b: return b
        b = active.filter(name__icontains=q).first()
        if b: return b
        b = active.filter(city__icontains=q).first()
        if b: return b
        b = active.filter(name__istartswith=q).first()
        if b: return b
        return None

    def _get_default_branch():
        """
        Returns the Head Office or primary branch. Priority:
          1. branch_type == 'head_office'
          2. is_primary == True
          3. Branch whose name contains HO keywords (ho, hq, head, main, headquarters)
          4. None — entry saved as unassigned (never pick a random branch)
        """
        active = Branch.objects.filter(business_id=business_id, is_active=True)
        b = active.filter(branch_type='head_office').order_by('created_at').first()
        if b: return b
        b = active.filter(is_primary=True).order_by('created_at').first()
        if b: return b
        # Check common HO name keywords — safe, doesn't pick random branches
        for kw in ('head office', 'head_office', 'headquarter', ' hq', ' ho ', '(ho)', '(hq)', 'main branch', 'main office'):
            b = active.filter(name__icontains=kw).first()
            if b: return b
        # DO NOT fall back to oldest/random branch — return None so entry is unassigned
        return None

    branch = _resolve_branch(parsed.get('branch_name') or '')

    # If no branch found (or none given), silently fall back to Head Office
    if not branch:
        branch = _get_default_branch()

    # Resolve category
    tx_type_str = 'income' if parsed['entry_type'] == 'credit' else 'expense'
    cat_name = parsed['category']
    category = TransactionCategory.objects.filter(
        business_id=business_id, name__iexact=cat_name,
        type=parsed['entry_type'],
    ).first()
    if not category and cat_name:
        try:
            category = TransactionCategory.objects.create(
                business_id=business_id, name=cat_name, type=parsed['entry_type'],
            )
        except Exception:
            category = None

    try:
        entry = CashbookEntry.objects.create(
            business_id=business_id,
            date=date.today(),
            type=parsed['entry_type'],
            amount=parsed['amount'],
            description=parsed['description'],
            payment_mode=parsed['payment_mode'],
            category=category,
            branch=branch,
            status=parsed.get('status', 'confirmed'),
            created_by=user,
        )

        amt_str = _format_amount(parsed['amount'])
        branch_str = branch.name if branch else 'Head Office'
        type_str = 'income' if parsed['entry_type'] == 'credit' else 'expense'
        mode_label = {
            'upi': 'UPI', 'cash': 'Cash', 'card': 'Card', 
            'bank_transfer': 'Bank Transfer', 'cheque': 'Cheque'
        }.get(parsed['payment_mode'], parsed['payment_mode'].title())

        if parsed.get('status') == 'pending':
            if type_str == 'income':
                response = f"Noted. I've recorded a pending receivable of {amt_str} as {cat_name} under {branch_str}."
            else:
                response = f"Got it. I've recorded a pending payable of {amt_str} for {cat_name} under {branch_str}."
        else:
            if type_str == 'income':
                response = f"Noted. I've recorded an income of {amt_str} as {cat_name} under {branch_str}."
            else:
                response = f"Got it. I've recorded an expense of {amt_str} for {cat_name}, paid via {mode_label}, under {branch_str}."
        logger.info("Voice add entry: %s | %s | %s", entry.id, type_str, amt_str)
        return {
            'intent': ChatIntent.WRITE_ACTION, 'domain': KnowledgeDomain.BUSINESS_DATA,
            'session_title': f"Add {type_str} — {parsed['description']}",
            'response_text': response, 'speech_text': response,
            'has_data': True,
            'query_result': {
                'entry_id': str(entry.id),
                'amount': float(parsed['amount']),
                'type': type_str,
                'description': parsed['description'],
                'payment_mode': mode_label,
                'branch': branch.name if branch else None,
                'date': str(date.today()),
                'category': cat_name,
            },
        }
    except Exception as exc:
        logger.error("Voice add entry failed: %s", exc)
        speech = f'Sorry, I could not record the entry. {exc}'
        return {
            'intent': ChatIntent.WRITE_ACTION, 'domain': KnowledgeDomain.BUSINESS_DATA,
            'response_text': speech, 'speech_text': 'Sorry, I could not record the entry. Please try again.',
            'has_data': False, 'query_result': {},
        }


# ─────────────────────────────────────────────────────────────────────────────
# VOICE: BRANCH CRUD
# ─────────────────────────────────────────────────────────────────────────────
def build_branch_crud_payload(
    user,
    business,
    business_id: str,
    text: str,
) -> dict:
    from apps.branches.models import Branch
    from apps.cashbook.models import CashbookEntry
    from django.db.models import Sum, Q

    lower = _normalize_text(text)

    # ── CREATE ────────────────────────────────────────────────
    if any(t in lower for t in ('create branch', 'add branch', 'new branch', 'open branch', 'set up branch')):
        name_match = re.search(
            r'(?:create|add|new|open|set\s+up)\s+(?:a\s+)?branch\s+(?:named?\s+|called\s+)?([\w\s]+)',
            lower,
        )
        if not name_match:
            speech = 'Please say the branch name. For example: create branch Nashik West.'
            return {
                'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
                'response_text': speech, 'speech_text': speech, 'has_data': False, 'query_result': {},
            }
        branch_name = name_match.group(1).strip().title()
        # Extract city hint from name if multiple words
        city = branch_name.split()[0] if branch_name else ''
        try:
            branch, created = Branch.objects.get_or_create(
                business=business,
                name=branch_name,
                defaults={'city': city, 'branch_type': Branch.BranchType.BRANCH},
            )
            if created:
                speech = f'Branch {branch_name} has been created successfully.'
            else:
                speech = f'A branch named {branch_name} already exists.'
            return {
                'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
                'session_title': f'Create Branch — {branch_name}',
                'response_text': speech, 'speech_text': speech,
                'has_data': created,
                'query_result': {'branch_id': str(branch.id), 'branch_name': branch_name, 'created': created},
            }
        except Exception as exc:
            logger.error('Voice create branch failed: %s', exc)
            speech = f'Could not create branch. {exc}'
            return {
                'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
                'response_text': speech, 'speech_text': 'Could not create the branch. Please try again.',
                'has_data': False, 'query_result': {},
            }

    # ── DELETE ────────────────────────────────────────────────
    if any(t in lower for t in ('delete branch', 'remove branch', 'close branch')):
        name_match = re.search(r'(?:delete|remove|close)\s+branch\s+(?:named?\s+|called\s+)?([\w\s]+)', lower)
        if not name_match:
            speech = 'Please say which branch to delete. For example: delete branch Nashik West.'
            return {
                'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
                'response_text': speech, 'speech_text': speech, 'has_data': False, 'query_result': {},
            }
        branch_name = name_match.group(1).strip().title()
        branch = Branch.objects.filter(business_id=business_id, name__icontains=branch_name, is_active=True).first()
        if not branch:
            speech = f'No active branch named {branch_name} was found.'
            return {
                'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
                'response_text': speech, 'speech_text': speech, 'has_data': False, 'query_result': {},
            }
        branch.is_active = False
        branch.save(update_fields=['is_active'])
        speech = f'Branch {branch.name} has been deactivated.'
        return {
            'intent': ChatIntent.MANAGE_ACCESS, 'domain': KnowledgeDomain.BUSINESS_DATA,
            'response_text': speech, 'speech_text': speech, 'has_data': True,
            'query_result': {'branch_id': str(branch.id), 'branch_name': branch.name},
        }

    # ── LIST ──────────────────────────────────────────────────
    branches = Branch.objects.filter(business_id=business_id, is_active=True).order_by('name')
    if not branches.exists():
        speech = 'No branches found for this business.'
        return {
            'intent': ChatIntent.DATA_QUERY, 'domain': KnowledgeDomain.BUSINESS_DATA,
            'response_text': speech, 'speech_text': speech, 'has_data': False, 'query_result': {},
        }

    # Build branch profit rows
    rows = []
    for b in branches:
        credit = CashbookEntry.objects.filter(
            business_id=business_id, branch=b, type=TransactionType.CREDIT,
            status=CashbookEntry.EntryStatus.CONFIRMED,
        ).aggregate(t=Sum('amount'))['t'] or 0
        debit = CashbookEntry.objects.filter(
            business_id=business_id, branch=b, type=TransactionType.DEBIT,
            status=CashbookEntry.EntryStatus.CONFIRMED,
        ).aggregate(t=Sum('amount'))['t'] or 0
        rows.append({'name': b.name, 'income': float(credit), 'expense': float(debit), 'profit': float(credit - debit)})

    names = [r['name'] for r in rows]
    speech_lines = [f'{r["name"]}: profit {_format_amount(r["profit"])}' for r in rows]
    response = f'You have {len(rows)} branches: {", ".join(names)}. Branch-wise profit — {" | ".join(speech_lines)}.'
    speech = f'You have {len(rows)} branches. {" ".join(speech_lines)}.'
    return {
        'intent': ChatIntent.DATA_QUERY, 'domain': KnowledgeDomain.BUSINESS_DATA,
        'session_title': 'Branch List & Profit',
        'response_text': response, 'speech_text': speech,
        'has_data': True, 'query_result': {'branches': rows},
    }


def format_structured_response(
    summary: str,
    key_points: Iterable[str] | None = None,
    next_steps: Iterable[str] | None = None,
    disclaimer: str | None = None,
) -> str:
    lines = ["Summary", str(summary or "").strip()]

    points = [str(point or "").strip() for point in (key_points or []) if str(point or "").strip()]
    if points:
        lines.append("Key points")
        lines.extend(f"- {point}" for point in points)

    steps = [str(step or "").strip() for step in (next_steps or []) if str(step or "").strip()]
    if steps:
        lines.append("Recommended next steps")
        lines.extend(steps)

    if disclaimer:
        lines.append(f"Disclaimer: {str(disclaimer).strip()}")

    return "\n".join(lines)


def make_voice_friendly_text(text: str, *, max_chars: int = VOICE_SPEECH_MAX_CHARS) -> str:
    raw = str(text or "").strip()
    if not raw:
        return ""

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if len(lines) == 1 and len(lines[0]) <= max_chars:
        return lines[0]

    summary_bits: list[str] = []
    point_bits: list[str] = []
    action_bits: list[str] = []
    mode = "summary"

    for line in lines:
        lower = line.lower()
        if lower in {"summary", "key points"}:
            continue
        if "recommended next steps" in lower or "action steps" in lower:
            mode = "actions"
            continue

        clean = line.replace("**", "").replace("#", "")
        clean = re.sub(r"^\d+[\.\)]\s*", "", clean)
        clean = clean.replace("-", " ").replace("*", " ")
        clean = re.sub(r"\s+", " ", clean).strip()
        if not clean or clean.lower().startswith("disclaimer"):
            continue

        if mode == "actions" or clean.lower().startswith(
            ("review ", "check ", "follow up ", "pay ", "submit ", "verify ", "consult ", "reconcile ")
        ):
            action_bits.append(clean)
            continue

        if not summary_bits:
            summary_bits.append(clean)
        else:
            point_bits.append(clean)

    speech_parts = []
    if summary_bits:
        speech_parts.append(summary_bits[0])
    speech_parts.extend(point_bits[:2])
    speech_parts.extend(action_bits[:2])

    speech_text = " ".join(speech_parts).strip()
    speech_text = re.sub(r"\s+", " ", speech_text)

    def _normalize_currency(value: str) -> str:
        def repl(match: re.Match) -> str:
            amount = match.group(1).replace(",", "")
            if amount.endswith(".00"):
                amount = amount[:-3]
            return f"{amount} rupees"

        cleaned = str(value or "")
        cleaned = re.sub(r"₹\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned)
        cleaned = re.sub(r"\bINR\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bRs\.?\s*(\d[\d,]*(?:\.\d+)?)", repl, cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace("₹", " rupees ")
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    speech_text = _normalize_currency(speech_text)
    if len(speech_text) > max_chars:
        speech_text = speech_text[: max_chars - 1].rstrip() + "…"
    return speech_text or raw[:max_chars]


def _month_to_date_snapshot(business_id: str) -> dict:
    from apps.dashboard.views import build_branches, build_top_expenses

    today = timezone.localdate()
    month_start = date(today.year, today.month, 1)

    entries = CashbookEntry.objects.filter(
        business_id=business_id,
        date__gte=month_start,
        date__lte=today,
        status=CashbookEntry.EntryStatus.CONFIRMED,
    )

    totals = entries.aggregate(
        income=Sum("amount", filter=Q(type=TransactionType.CREDIT)),
        expense=Sum("amount", filter=Q(type=TransactionType.DEBIT)),
        total_entries=Count("id"),
    )

    income = float(totals.get("income") or 0)
    expense = float(totals.get("expense") or 0)
    profit = income - expense
    margin = round((profit / income) * 100, 1) if income > 0 else 0.0

    return {
        "period_label": today.strftime("%B %Y"),
        "month_start": str(month_start),
        "today": str(today),
        "income": income,
        "expense": expense,
        "profit": profit,
        "profit_margin": margin,
        "entry_count": int(totals.get("total_entries") or 0),
        "branches": build_branches(business_id) or [],
        "top_expenses": build_top_expenses(business_id, limit=3) or [],
    }


def _due_snapshot(business_id: str) -> dict:
    today = timezone.localdate()
    due_entries = (
        CashbookEntry.objects.filter(
            business_id=business_id,
            status=CashbookEntry.EntryStatus.PENDING,
        )
        .filter(
            Q(category__name__iexact="receivable")
            | Q(category__name__iexact="payable")
        )
        .select_related("branch", "category")
        .order_by("date", "created_at")
    )

    items: list[dict] = []
    receivable_total = 0.0
    payable_total = 0.0

    for entry in due_entries:
        kind = "receivable" if entry.type == TransactionType.CREDIT else "payable"
        amount = float(entry.amount or 0)
        if kind == "receivable":
            receivable_total += amount
        else:
            payable_total += amount

        days_left = (entry.date - today).days
        items.append({
            "id": str(entry.id),
            "kind": kind,
            "party_name": entry.party_name or entry.description or "Unknown",
            "amount": amount,
            "date": str(entry.date),
            "date_label": _format_date(entry.date),
            "days_left": days_left,
            "branch_name": getattr(entry.branch, "name", "") or "Head Office",
        })

    overdue_count = sum(1 for item in items if item["days_left"] < 0)
    return {
        "receivable_total": receivable_total,
        "payable_total": payable_total,
        "count": len(items),
        "overdue_count": overdue_count,
        "items": items[:5],
    }


def build_business_summary_payload(user_name: str, business_name: str, business_id: str) -> dict:
    snapshot = _month_to_date_snapshot(business_id)
    due = _due_snapshot(business_id)

    branches = snapshot["branches"]
    top_branch = branches[0] if branches else None
    top_expense = snapshot["top_expenses"][0] if snapshot["top_expenses"] else None

    if snapshot["profit"] >= 0:
        summary = (
            f"{business_name} has {_format_amount(snapshot['income'])} income, "
            f"{_format_amount(snapshot['expense'])} expenses, and {_format_amount(snapshot['profit'])} profit this month."
        )
    else:
        summary = (
            f"{business_name} has {_format_amount(snapshot['income'])} income, "
            f"{_format_amount(snapshot['expense'])} expenses, and a loss of {_format_amount(abs(snapshot['profit']))} this month."
        )

    key_points = [
        f"Profit margin is {snapshot['profit_margin']:.1f}%.",
        f"Confirmed entries this month: {snapshot['entry_count']}.",
    ]

    if top_branch:
        branch_profit = float(top_branch.get("profit") or top_branch.get("month_profit") or 0)
        key_points.append(
            f"Best branch is {top_branch.get('name', 'the top branch')} with {_format_amount(branch_profit)} profit."
        )

    if top_expense:
        key_points.append(
            f"Top expense driver is {top_expense.get('description', 'an expense category')} at {_format_amount(top_expense.get('total') or top_expense.get('amount') or 0)}."
        )

    key_points.append(
        f"Pending receivables total {_format_amount(due['receivable_total'])} and pending payables total {_format_amount(due['payable_total'])}."
    )

    next_steps = [
        "Review the top expense driver before the next payout cycle.",
        "Follow up the largest receivable first.",
        "Ask for branch-wise profit if you want a deeper split.",
    ]

    response_text = format_structured_response(
        f"{_greeting_for_now()} {user_name or 'there'}. {summary}",
        key_points=key_points,
        next_steps=next_steps,
        disclaimer="This is an operational business briefing based on confirmed cashbook entries.",
    )

    speech_text = (
        f"{_greeting_for_now()} {user_name or 'there'}. {business_name} recorded "
        f"{_format_amount(snapshot['income'])} income and {_format_amount(snapshot['expense'])} expenses this month, "
        f"so the current profit is {_format_amount(snapshot['profit'])}. "
    )
    if top_branch:
        branch_profit = float(top_branch.get("profit") or top_branch.get("month_profit") or 0)
        speech_text += (
            f"{top_branch.get('name', 'The best branch')} is performing best with {_format_amount(branch_profit)} profit. "
        )
    if due["count"]:
        first_due = due["items"][0]
        speech_text += (
            f"You have {due['count']} pending receivables or payables. "
            f"The next due is {first_due['party_name']} for {_format_amount(first_due['amount'])} on {first_due['date_label']}. "
        )
    if top_expense:
        speech_text += (
            f"Your biggest expense driver is {top_expense.get('description', 'one of your expenses')}. "
        )
    speech_text = re.sub(r"\s+", " ", speech_text).strip()

    return {
        "intent": ChatIntent.DATA_QUERY,
        "domain": SUMMARY_DOMAIN,
        "session_title": "Business summary",
        "response_text": response_text,
        "speech_text": speech_text,
        "query_result": {
            "snapshot": snapshot,
            "due": due,
        },
        "has_data": True,
    }


def build_branch_summary_payload(business_name: str, business_id: str) -> dict:
    snapshot = _month_to_date_snapshot(business_id)
    branches = snapshot["branches"]

    if not branches:
        response_text = format_structured_response(
            f"No branch profit data is available yet for {business_name}.",
            next_steps=[
                "Start tagging transactions by branch to unlock branch-wise ranking.",
                "Ask again after a few confirmed branch entries are recorded.",
            ],
            disclaimer="Branch ranking is based on confirmed entries only.",
        )
        speech_text = (
            f"No branch profit data is available yet for {business_name}. "
            "Start tagging transactions by branch to unlock branch-wise ranking."
        )
        return {
            "intent": ChatIntent.DATA_QUERY,
            "domain": SUMMARY_DOMAIN,
            "session_title": "Branch profit",
            "response_text": response_text,
            "speech_text": speech_text,
            "query_result": {"snapshot": snapshot},
            "has_data": False,
        }

    top = branches[0]
    top_profit = float(top.get("profit") or top.get("month_profit") or 0)
    points = [
        f"{top.get('name', 'The top branch')} leads with {_format_amount(top_profit)} profit.",
    ]
    if len(branches) > 1:
        second = branches[1]
        second_profit = float(second.get("profit") or second.get("month_profit") or 0)
        points.append(
            f"Next is {second.get('name', 'the second branch')} with {_format_amount(second_profit)} profit."
        )
    if len(branches) > 2:
        third = branches[2]
        third_profit = float(third.get("profit") or third.get("month_profit") or 0)
        points.append(
            f"Third place is {third.get('name', 'the third branch')} with {_format_amount(third_profit)} profit."
        )

    response_text = format_structured_response(
        f"{top.get('name', 'The top branch')} is the highest-profit branch this month with {_format_amount(top_profit)} profit.",
        key_points=points,
        next_steps=[
            "Review the weakest branch and its top expense driver.",
            "Ask for a monthly branch trend if you want deeper comparison.",
        ],
        disclaimer="Branch comparison is based on confirmed cashbook entries for the current month.",
    )

    speech_text = (
        f"{top.get('name', 'The top branch')} is the highest-profit branch this month with "
        f"{_format_amount(top_profit)} profit."
    )
    if len(branches) > 1:
        second = branches[1]
        speech_text += (
            f" Next is {second.get('name', 'the second branch')} with "
            f"{_format_amount(float(second.get('profit') or second.get('month_profit') or 0))} profit."
        )

    return {
        "intent": ChatIntent.DATA_QUERY,
        "domain": SUMMARY_DOMAIN,
        "session_title": "Branch profit",
        "response_text": response_text,
        "speech_text": speech_text,
        "query_result": {"snapshot": snapshot},
        "has_data": True,
    }


def build_due_summary_payload(business_name: str, business_id: str) -> dict:
    snapshot = _due_snapshot(business_id)

    if snapshot["count"] == 0:
        response_text = format_structured_response(
            f"You do not have any pending receivables or payables for {business_name}.",
            next_steps=[
                "Ask for the latest transactions if you want a full cashbook review.",
            ],
            disclaimer="This summary only includes pending receivable and payable entries.",
        )
        speech_text = f"You do not have any pending receivables or payables for {business_name}."
        return {
            "intent": ChatIntent.DATA_QUERY,
            "domain": SUMMARY_DOMAIN,
            "response_text": response_text,
            "speech_text": speech_text,
            "query_result": {"due": snapshot},
            "has_data": False,
        }

    receivable_total = _format_amount(snapshot["receivable_total"])
    payable_total = _format_amount(snapshot["payable_total"])

    points = [
        f"Receivable total is {receivable_total}.",
        f"Payable total is {payable_total}.",
    ]
    if snapshot["overdue_count"]:
        points.append(f"{snapshot['overdue_count']} item(s) are overdue.")

    for item in snapshot["items"][:3]:
        kind_label = "Receivable" if item["kind"] == "receivable" else "Payable"
        points.append(
            f"{kind_label} from {item['party_name']} for {_format_amount(item['amount'])} due on {item['date_label']} at {item['branch_name']}."
        )

    response_text = format_structured_response(
        f"You have {receivable_total} receivable and {payable_total} payable pending for {business_name}.",
        key_points=points,
        next_steps=[
            "Follow up overdue receivables first.",
            "Review payables that are due in the next few days.",
        ],
        disclaimer="This summary only includes pending receivable and payable entries.",
    )

    speech_text = f"You have {receivable_total} receivable and {payable_total} payable pending for {business_name}. "
    if snapshot["items"]:
        first = snapshot["items"][0]
        speech_text += (
            f"The next due is {first['party_name']} for {_format_amount(first['amount'])} on {first['date_label']}. "
        )
    if snapshot["overdue_count"]:
        speech_text += f"{snapshot['overdue_count']} item(s) are overdue. "

    return {
        "intent": ChatIntent.DATA_QUERY,
        "domain": SUMMARY_DOMAIN,
        "response_text": response_text,
        "speech_text": speech_text.strip(),
        "query_result": {"due": snapshot},
        "has_data": True,
    }


def build_briefing_payload(user_name: str, business_name: str, business_id: str) -> dict:
    snapshot = _month_to_date_snapshot(business_id)
    due = _due_snapshot(business_id)
    branches = snapshot["branches"]
    top_branch = branches[0] if branches else None

    if snapshot["profit"] >= 0:
        lead_line = f"{business_name} is performing well with {_format_amount(snapshot['profit'])} profit this month."
    else:
        lead_line = f"{business_name} is currently at a loss of {_format_amount(abs(snapshot['profit']))} this month."

    key_points = [
        f"Income this month: {_format_amount(snapshot['income'])}.",
        f"Expenses this month: {_format_amount(snapshot['expense'])}.",
        f"Pending receivables: {_format_amount(due['receivable_total'])}.",
        f"Pending payables: {_format_amount(due['payable_total'])}.",
    ]

    if top_branch:
        top_profit = float(top_branch.get("profit") or top_branch.get("month_profit") or 0)
        key_points.append(
            f"Best branch: {top_branch.get('name', 'the top branch')} with {_format_amount(top_profit)} profit."
        )

    response_text = format_structured_response(
        f"{_greeting_for_now()} {user_name or 'there'}. {lead_line}",
        key_points=key_points,
        next_steps=[
            "Review the top expense driver before the next payout cycle.",
            "Follow up the largest receivable first.",
            "Ask me for branch-wise profit or pending dues if you want more detail.",
        ],
        disclaimer="This briefing is based on confirmed cashbook entries and branch-level totals.",
    )

    speech_text = (
        f"{_greeting_for_now()} {user_name or 'there'}. "
        f"{business_name} recorded {_format_amount(snapshot['income'])} income and "
        f"{_format_amount(snapshot['expense'])} expenses this month, so the current profit is "
        f"{_format_amount(snapshot['profit'])}. "
    )
    if top_branch:
        top_profit = float(top_branch.get("profit") or top_branch.get("month_profit") or 0)
        speech_text += f"{top_branch.get('name', 'The top branch')} is leading with {_format_amount(top_profit)} profit. "
    if due["count"]:
        first_due = due["items"][0]
        speech_text += (
            f"You also have {due['count']} pending receivables or payables. "
            f"The next due is {first_due['party_name']} for {_format_amount(first_due['amount'])} on {first_due['date_label']}. "
        )
    speech_text = re.sub(r"\s+", " ", speech_text).strip()

    return {
        "intent": ChatIntent.BUSINESS_INSIGHT,
        "domain": INSIGHT_DOMAIN,
        "session_title": "Morning briefing",
        "response_text": response_text,
        "speech_text": speech_text,
        "query_result": {
            "snapshot": snapshot,
            "due": due,
        },
        "has_data": True,
    }


def build_wake_greeting_payload(user_name: str, business_name: str = "", business_id: str | None = None) -> dict:
    greeting = _greeting_for_now()
    if business_name and business_id:
        summary = f"{greeting} {user_name or 'there'}. I am listening for {business_name}. Say what you need and I will handle it."
        points = [
            "You can ask for profit, dues, branch performance, or staff and branch actions.",
            "Say a full command like create branch, add an entry, or show receivables.",
        ]
        speech_text = (
            f"{greeting} {user_name or 'there'}. I am ready for {business_name}. "
            "Tell me what you want to do."
        )
    else:
        summary = f"{greeting} {user_name or 'there'}. I am listening. Tell me what you want help with."
        points = [
            "You can ask business questions, add entries, manage branches, or manage staff access.",
            "Select a business first if you want branch, cashbook, or dues actions.",
        ]
        speech_text = (
            f"{greeting} {user_name or 'there'}. I am listening. "
            "Tell me what you want help with."
        )

    response_text = format_structured_response(
        summary,
        key_points=points,
        next_steps=[
            "Say a full command after the wake phrase, for example: hey buddy show my total profit.",
            "For CRUD actions, say the exact action you want, such as create branch Nashik West.",
        ],
        disclaimer="Voice actions work best when you say the full request in one sentence.",
    )

    return {
        "intent": ChatIntent.GENERAL,
        "domain": KnowledgeDomain.GENERAL,
        "session_title": "Voice assistant",
        "response_text": response_text,
        "speech_text": speech_text,
        "query_result": {
            "business_id": business_id or "",
            "business_name": business_name or "",
        },
        "has_data": bool(business_id),
    }


def _persist_voice_exchange(
    *,
    session: ChatSession,
    user,
    user_message: str,
    assistant_message: str,
    intent: str,
    domain: str,
    model_used: str,
    query_result: dict,
    has_data: bool,
    tokens_used: int = 0,
    processing_time: float = 0.0,
    action_taken: bool = False,
    session_title: str | None = None,
) -> tuple[ChatMessage, ChatMessage]:
    safe_intent = _voice_intent_choice(intent)
    safe_domain = _voice_domain_choice(domain)

    if session_title and not session.title:
        session.title = session_title[:255]
        session.save(update_fields=["title", "updated_at"])

    user_entry = ChatMessage.objects.create(
        session=session,
        role=ChatMessage.Role.USER,
        content=user_message or assistant_message,
        intent=safe_intent,
        domain=safe_domain,
    )
    assistant_entry = ChatMessage.objects.create(
        session=session,
        role=ChatMessage.Role.ASSISTANT,
        content=assistant_message,
        intent=safe_intent,
        domain=safe_domain,
        model_used=model_used or "voice-assistant",
        tokens_used=max(int(tokens_used or 0), 0),
        processing_time=max(float(processing_time or 0.0), 0.0),
        query_result=query_result or {},
        has_data=bool(has_data),
        action_taken=bool(action_taken),
    )
    return user_entry, assistant_entry


# External integrations are defined below.


def transcribe_audio_with_assemblyai(file_path: str | Path) -> str:
    api_key = getattr(settings, "ASSEMBLYAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("ASSEMBLYAI_API_KEY is not configured.")

    upload_url = "https://api.assemblyai.com/v2/upload"
    transcript_url = "https://api.assemblyai.com/v2/transcript"
    path = Path(file_path)

    with path.open("rb") as handle:
        upload_res = requests.post(
            upload_url,
            headers={"authorization": api_key},
            data=handle,
            timeout=ASSEMBLYAI_UPLOAD_TIMEOUT,
        )
    upload_res.raise_for_status()
    audio_url = upload_res.json().get("upload_url")
    if not audio_url:
        raise ValueError("AssemblyAI did not return an upload URL.")

    transcript_res = requests.post(
        transcript_url,
        headers={"authorization": api_key, "content-type": "application/json"},
        json={"audio_url": audio_url},
        timeout=ASSEMBLYAI_TRANSCRIPT_TIMEOUT,
    )
    transcript_res.raise_for_status()
    transcript_id = transcript_res.json().get("id")
    if not transcript_id:
        raise ValueError("AssemblyAI did not return a transcript ID.")

    start = time.time()
    while True:
        poll = requests.get(
            f"{transcript_url}/{transcript_id}",
            headers={"authorization": api_key},
            timeout=ASSEMBLYAI_TRANSCRIPT_TIMEOUT,
        )
        poll.raise_for_status()
        payload = poll.json()

        if payload.get("status") == "completed":
            return payload.get("text", "").strip()

        if payload.get("status") == "error":
            raise ValueError(f"AssemblyAI Error: {payload.get('error')}")

        if time.time() - start > ASSEMBLYAI_TOTAL_TIMEOUT:
            raise TimeoutError("AssemblyAI transcription timed out.")

        time.sleep(ASSEMBLYAI_POLL_INTERVAL)


def generate_murf_audio_file(
    text: str,
    voice_id: str | None = None,
    voice_style: str | None = None,
    voice_model: str | None = None,
    request=None,
) -> str | None:
    api_key = getattr(settings, "MURF_API_KEY", "").strip()
    if not api_key:
        return None

    voice = (voice_id or getattr(settings, "MURF_VOICE_ID", "Anisha") or "Anisha").strip()
    style = (voice_style or getattr(settings, "MURF_VOICE_STYLE", "Conversation") or "Conversation").strip()
    model = (voice_model or getattr(settings, "MURF_VOICE_MODEL", "FALCON") or "FALCON").strip().upper()
    if not text or not text.strip():
        return None

    if voice.lower() == "anisha":
        voice = "en-IN-isha"
    if style.lower() == "conversation":
        style = "Conversational"

    try:
        url = "https://api.murf.ai/v1/speech/generate"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        payload = {
            "voiceId": voice,
            "style": style,
            "format": "MP3",
            "text": text[:MURF_AUDIO_TEXT_LIMIT],
        }


        response = requests.post(url, headers=headers, json=payload, timeout=MURF_REQUEST_TIMEOUT)
        response.raise_for_status()
        body = response.json()
        audio_source = body.get("audioFile") or body.get("audioUrl") or body.get("audio_url")
        if not audio_source:
            return None

        # Speed optimization: Return the source URL directly to the client
        # instead of downloading and serving from our own static storage.
        return audio_source
    except Exception as exc:
        logger.warning("Murf audio generation failed: %s", exc)
        return None


def resolve_voice_session(
    user,
    business_id: str | None,
    session_id: str | None = None,
    *,
    create_if_missing: bool = True,
) -> ChatSession | None:
    session = None
    if session_id:
        session = ChatSession.objects.filter(
            id=session_id,
            user=user,
            is_active=True,
        ).select_related("business").first()

    if session and business_id and not session.business_id:
        session.business_id = business_id
        session.save(update_fields=["business", "updated_at"])

    if session:
        return session

    if not create_if_missing:
        return None

    return ChatSession.objects.create(user=user, business_id=business_id or None)


def build_chatbot_voice_payload(
    *,
    session: ChatSession,
    user,
    business_id: str | None,
    user_message: str,
    voice_id: str | None = None,
    voice_style: str | None = None,
    voice_model: str | None = None,
    request=None,
) -> dict:
    result = process_chat_message(
        session=session,
        user_message=user_message,
        business_id=business_id,
        user=user,
    )

    response_text = result["response"]
    speech_text = make_voice_friendly_text(response_text)
    audio_url = generate_murf_audio_file(
        speech_text,
        voice_id=voice_id,
        voice_style=voice_style,
        voice_model=voice_model,
        request=request,
    )

    return {
        "mode": "chat",
        "intent": result.get("intent", "general"),
        "domain": result.get("domain", "general"),
        "response_text": response_text,
        "speech_text": speech_text,
        "audio_url": audio_url,
        "session_id": str(session.id),
        "model_used": result.get("model_used", ""),
        "has_data": result.get("has_data", False),
        "query_result": result.get("query_result", {}),
        "processing_time": result.get("processing_time", 0),
        "tokens_used": result.get("tokens_used", 0),
    }


def handle_voice_assistant_request(
    *,
    user,
    business_id: str | None,
    session_id: str | None = None,
    mode: str = "command",
    text: str | None = None,
    audio_file=None,
    voice_id: str | None = None,
    voice_style: str | None = None,
    voice_model: str | None = None,
    request=None,
) -> dict:
    started_at = time.time()
    original_text = str(text or "").strip()
    resolved_business_id = str(business_id or "").strip() or None
    resolved_session = resolve_voice_session(
        user,
        resolved_business_id,
        session_id=session_id,
        create_if_missing=False,
    )
    business = None

    from apps.business.views import get_business_or_error

    def _extract_error_message(err) -> str:
        try:
            if hasattr(err, "data") and isinstance(err.data, dict):
                return err.data.get("message") or err.data.get("detail") or "Business not found or access denied."
            if isinstance(err, dict):
                return err.get("message") or err.get("detail") or "Business not found or access denied."
        except Exception:
            pass
        return "Business not found or access denied."

    if resolved_business_id:
        business, err = get_business_or_error(resolved_business_id, user)
        if err:
            raise ValueError(_extract_error_message(err))
    elif resolved_session and resolved_session.business_id:
        resolved_business_id = str(resolved_session.business_id)
        business, err = get_business_or_error(resolved_business_id, user)
        if err:
            raise ValueError(_extract_error_message(err))

    if resolved_session is None:
        resolved_session = resolve_voice_session(
            user,
            resolved_business_id,
            session_id=session_id,
            create_if_missing=True,
        )

    final_voice_id = (voice_id or getattr(settings, "MURF_VOICE_ID", "Anisha") or "Anisha").strip()
    final_voice_style = (voice_style or getattr(settings, "MURF_VOICE_STYLE", "Conversation") or "Conversation").strip()
    final_voice_model = (voice_model or getattr(settings, "MURF_VOICE_MODEL", "FALCON") or "FALCON").strip().upper()

    if audio_file is not None and not original_text:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            for chunk in audio_file.chunks():
                tmp.write(chunk)
            temp_path = Path(tmp.name)
        try:
            original_text = transcribe_audio_with_assemblyai(temp_path)
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass

    clean_text, wake_only = strip_wake_phrase(original_text)
    classification_input = clean_text or original_text
    transcript_text = original_text or clean_text

    if wake_only and not clean_text and mode != "briefing":
        payload = build_wake_greeting_payload(
            getattr(user, "full_name", "") or getattr(user, "email", ""),
            business.name if business else "",
            resolved_business_id,
        )
    elif mode == "briefing":
        if not business:
            raise ValueError("Please select a business before asking for a briefing.")
        payload = build_briefing_payload(
            getattr(user, "full_name", "") or getattr(user, "email", ""),
            business.name,
            resolved_business_id,
        )
    else:
        # ── Pending branch-reply intercept ─────────────────────────────────────
        # If the previous turn asked "which branch?", the user's reply (e.g. "Nashik")
        # must be treated as a branch name, NOT as a new command.
        if resolved_business_id and user:
            from django.core.cache import cache
            pending_cache_key = f"voice_pending_entry:{resolved_business_id}:{getattr(user, 'id', 'anon')}"
            pending_parsed = cache.get(pending_cache_key)
            if pending_parsed:
                cache.delete(pending_cache_key)  # consume immediately
                # The clean_text is the branch name the user just said
                pending_parsed['branch_name'] = clean_text or classification_input
                payload = build_add_entry_payload(
                    user=user,
                    business=business,
                    business_id=resolved_business_id,
                    text='',
                    parsed=pending_parsed,
                )

                # If branch still not resolved (typo etc), re-ask
                if not payload.get('has_data'):
                    speech = (
                        f"Sorry, I couldn't find a branch called '{clean_text}'. "
                        "Please say the exact branch name."
                    )
                    payload = {
                        'intent': ChatIntent.WRITE_ACTION, 'domain': KnowledgeDomain.BUSINESS_DATA,
                        'response_text': speech, 'speech_text': speech,
                        'has_data': False, 'query_result': {},
                    }
                    # Re-save pending so user gets another chance
                    cache.set(pending_cache_key, {
                        k: v for k, v in pending_parsed.items() if k != 'branch_name'
                    }, timeout=300)

                speech_text = make_voice_friendly_text(payload.get('speech_text') or payload.get('response_text', ''))
                audio_url = generate_murf_audio_file(
                    speech_text,
                    voice_id=final_voice_id,
                    voice_style=final_voice_style,
                    voice_model=final_voice_model,
                    request=request,
                )
                total_elapsed = round(time.time() - started_at, 2)
                _persist_voice_exchange(
                    session=resolved_session,
                    user=user,
                    user_message=transcript_text or clean_text or '',
                    assistant_message=payload.get('response_text', ''),
                    intent=payload.get('intent', ChatIntent.GENERAL),
                    domain=payload.get('domain', KnowledgeDomain.GENERAL),
                    model_used='voice-deterministic',
                    query_result=payload.get('query_result', {}),
                    has_data=payload.get('has_data', False),
                    processing_time=total_elapsed,
                    session_title=payload.get('session_title'),
                )
                return {
                    **payload,
                    'speech_text': speech_text,
                    'audio_url': audio_url,
                    'session_id': str(resolved_session.id),
                    'transcript': transcript_text,
                    'business_id': resolved_business_id,
                    'business_name': business.name if business else '',
                    'processing_time': total_elapsed,
                    'voice_mode': 'command',
                }

        classification = classify_voice_request(classification_input)
        if classification == "briefing":
            if not business:
                raise ValueError("Please select a business before asking for a briefing.")
            payload = build_briefing_payload(
                getattr(user, "full_name", "") or getattr(user, "email", ""),
                business.name,
                resolved_business_id,
            )
        elif classification == "business_summary":
            if not business:
                raise ValueError("Please select a business before asking for a summary.")
            payload = build_business_summary_payload(
                getattr(user, "full_name", "") or getattr(user, "email", ""),
                business.name,
                resolved_business_id,
            )
        elif classification == "branch_summary":
            if not business:
                raise ValueError("Please select a business before asking for branch performance.")
            payload = build_branch_summary_payload(
                business.name,
                resolved_business_id,
            )
        elif classification == "due_summary":
            if not business:
                raise ValueError("Please select a business before asking for dues.")
            payload = build_due_summary_payload(
                business.name,
                resolved_business_id,
            )
        elif classification == "add_entry":
            if not business:
                raise ValueError("Please select a business before recording entries.")
            payload = build_add_entry_payload(
                user=user,
                business=business,
                business_id=resolved_business_id,
                text=clean_text,
            )
        elif classification == "branch_crud":
            if not business:
                raise ValueError("Please select a business before managing branches.")
            payload = build_branch_crud_payload(
                user=user,
                business=business,
                business_id=resolved_business_id,
                text=clean_text,
            )
        else:
            if not clean_text:
                raise ValueError("Please say something or type a command.")
            payload = build_chatbot_voice_payload(
                session=resolved_session,
                user=user,
                business_id=resolved_business_id,
                user_message=clean_text,
                voice_id=final_voice_id,
                voice_style=final_voice_style,
                voice_model=final_voice_model,
                request=request,
            )
            total_elapsed = round(time.time() - started_at, 2)
            return {
                **payload,
                "transcript": transcript_text,
                "business_id": resolved_business_id,
                "business_name": business.name if business else "",
                "processing_time": total_elapsed,
                "voice_mode": "command",
            }

    speech_text = make_voice_friendly_text(payload.get("speech_text") or payload.get("response_text", ""))
    audio_url = generate_murf_audio_file(
        speech_text,
        voice_id=final_voice_id,
        voice_style=final_voice_style,
        voice_model=final_voice_model,
        request=request,
    )
    total_elapsed = round(time.time() - started_at, 2)

    _persist_voice_exchange(
        session=resolved_session,
        user=user,
        user_message=transcript_text or clean_text or speech_text,
        assistant_message=payload.get("response_text", ""),
        intent=payload.get("intent", ChatIntent.GENERAL),
        domain=payload.get("domain", KnowledgeDomain.GENERAL),
        model_used="voice-deterministic",
        query_result=payload.get("query_result", {}),
        has_data=payload.get("has_data", False),
        processing_time=total_elapsed,
        session_title=payload.get("session_title"),
    )

    return {
        **payload,
        "speech_text": speech_text,
        "audio_url": audio_url,
        "session_id": str(resolved_session.id),
        "transcript": transcript_text,
        "business_id": resolved_business_id,
        "business_name": business.name if business else "",
        "processing_time": total_elapsed,
        "voice_mode": "briefing" if payload.get("intent") == ChatIntent.BUSINESS_INSIGHT else "summary",
    }
