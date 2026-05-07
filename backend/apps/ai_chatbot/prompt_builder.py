from __future__ import annotations

from dataclasses import dataclass


AMBIGUOUS_INPUTS = {
    "help",
    "hello",
    "hi",
    "hey",
    "details",
    "what now",
    "next",
    "why",
    "how",
    "show me",
    "tell me more",
}


@dataclass
class BusinessContext:
    business_name: str = ""
    category: str = ""
    role: str = ""
    member_count: int = 0
    branch_count: int = 0
    recent_income: float = 0.0
    recent_expense: float = 0.0
    has_recent_transactions: bool = False


def is_unclear_message(message: str) -> bool:
    cleaned = " ".join((message or "").strip().lower().split())
    if not cleaned:
        return True
    if cleaned in AMBIGUOUS_INPUTS:
        return True
    words = cleaned.split()
    if len(words) == 1 and len(cleaned) <= 4:
        return True
    return False


def detect_aggregate_scope(message: str) -> str:
    cleaned = (message or "").lower()
    if any(phrase in cleaned for phrase in [
        "all time", "overall", "till date", "to date", "lifetime",
        "entire period", "since start", "from beginning",
    ]):
        return "overall"

    if any(phrase in cleaned for phrase in [
        "current", "current month", "this month", "this week", "today",
        "yesterday", "last week", "last month", "this year", "last year",
        "current income", "current profit", "current expense",
    ]):
        return "current_period"

    if "total" in cleaned and any(word in cleaned for word in [
        "profit", "income", "expense", "expenses", "revenue", "sales", "balance",
    ]):
        return "overall"

    return "current_period"


def summarize_history(history: list[dict], max_items: int = 4) -> str:
    items = []
    for turn in history[-max_items:]:
        role = str(turn.get("role") or "user").capitalize()
        content = str(turn.get("content") or "").strip()
        if content:
            items.append(f"{role}: {content[:180]}")
    return "\n".join(items)


def build_system_prompt(base_prompt: str, business_context: BusinessContext | None = None, history_summary: str = "") -> str:
    context_lines = [
        base_prompt.strip(),
        "",
        "Response rules:",
        "- Give a direct business-first answer.",
        "- Default to this structure when possible: Summary, Key points, Recommended next steps, Disclaimer.",
        "- Make the response useful, not minimal; prefer 120-220 words unless the user clearly asks for a short answer.",
        "- Include assumptions clearly when the question depends on period, tax regime, or missing business data.",
        "- Add 2 to 4 concrete points instead of generic filler.",
        "- Ask one clarifying question if the request is ambiguous.",
        "- Avoid saying 'I don't know'; explain what is missing and suggest a next step.",
        "- Suggest 2 or 3 useful next actions when possible.",
    ]

    if business_context:
        context_lines.extend(
            [
                "",
                "Business context:",
                f"- Business: {business_context.business_name or 'Unknown'}",
                f"- Category: {business_context.category or 'Unknown'}",
                f"- User role: {business_context.role or 'Unknown'}",
                f"- Branches: {business_context.branch_count}",
                f"- Active members: {business_context.member_count}",
            ]
        )
        if business_context.has_recent_transactions:
            context_lines.extend(
                [
                    f"- Recent income: Rs {business_context.recent_income:,.2f}",
                    f"- Recent expense: Rs {business_context.recent_expense:,.2f}",
                ]
            )

    if history_summary:
        context_lines.extend(["", "Recent conversation summary:", history_summary])

    return "\n".join(context_lines)


def build_clarifying_response(message: str, business_context: BusinessContext | None = None) -> str:
    role = (business_context.role or "team member").replace("_", " ").title() if business_context else "Team Member"
    business_name = business_context.business_name if business_context else ""
    lead = f"I can help with {business_name} data, compliance guidance, and operational next steps." if business_name else "I can help with business data, compliance guidance, and operational next steps."
    return (
        f"Summary\n"
        f"{lead}\n"
        f"- Your last message was a bit unclear, so I want to avoid guessing.\n"
        f"- I can answer as a {role}-focused business assistant.\n"
        f"Review whether you want one of these:\n"
        f"Check cash flow or profit for a period.\n"
        f"Review GST, TDS, or compliance guidance.\n"
        f"Verify a transaction, report, or branch performance question.\n"
    )


def build_follow_up_suggestions(intent: str, domain: str, business_context: BusinessContext | None = None) -> list[str]:
    role = (business_context.role or "").lower()
    suggestions: list[str] = []

    if intent == "data_query" or domain == "business_data":
        suggestions.extend(
            [
                "Review the top expense drivers for this period.",
                "Check whether any branch needs cost control.",
            ]
        )
    elif intent == "business_insight":
        suggestions.extend(
            [
                "Review the weakest branch and assign one corrective action.",
                "Check whether month-on-month expenses are growing faster than income.",
            ]
        )
    elif intent == "manage_access":
        suggestions.extend(
            [
                "Create a branch if the team needs a new operating location.",
                "Add or deactivate staff after checking branch access requirements.",
                "Change a member's role if their responsibilities have shifted.",
            ]
        )
    elif intent == "knowledge_query":
        suggestions.extend(
            [
                "Check whether this applies to your turnover, entity type, and filing regime.",
                "Ask for a comparison with the old regime, 44AD, or GST composition if relevant.",
            ]
        )
    else:
        suggestions.extend(
            [
                "Review the exact section or filing impact before taking action.",
                "Check whether this affects your current month compliance calendar.",
            ]
        )

    if "owner" in role:
        suggestions.append("Review branch profitability and cash discipline before the next payout cycle.")
    elif "manager" in role:
        suggestions.append("Check team or branch-level execution gaps behind the numbers.")
    elif "accountant" in role or role == "ca":
        suggestions.append("Reconcile supporting entries and confirm the compliance treatment.")
    elif "staff" in role:
        suggestions.append("Verify the source records and share any missing transaction details.")

    deduped = []
    for suggestion in suggestions:
        if suggestion not in deduped:
            deduped.append(suggestion)
    return deduped[:3]
