from __future__ import annotations

import re


SECTION_RE = re.compile(r"^(summary|key points|action steps|next steps|disclaimer)\b", re.IGNORECASE)


def _clean_lines(text: str) -> list[str]:
    return [line.strip() for line in str(text or "").splitlines() if line.strip()]


def _sentence_split(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", str(text or "").strip())
    return [part.strip() for part in parts if part.strip()]


def _normalize_bullet(line: str) -> str:
    return re.sub(r"^[\-\*\d\.\)\s]+", "", line).strip()


def _strip_formatting(line: str) -> str:
    cleaned = str(line or "").strip()
    cleaned = re.sub(r"^\W+", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"^\*(.*?)\*$", r"\1", cleaned)
    cleaned = re.sub(r"^[#>\-\*\d\.\)\s]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        key = re.sub(r"[^a-z0-9]+", "", item.lower())
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _build_action_lines(suggestions: list[str] | None) -> list[str]:
    suggestions = [s.strip() for s in (suggestions or []) if s and s.strip()]
    action_lines = []
    for suggestion in suggestions[:3]:
        if suggestion.lower().startswith(("review ", "check ", "verify ", "ensure ", "submit ", "reconcile ", "consult ", "pay ", "file ")):
            action_lines.append(suggestion)
        else:
            action_lines.append(f"Review {suggestion[0].lower() + suggestion[1:]}" if suggestion else suggestion)
    return _dedupe(action_lines)


def _append_supporting_sections(
    text: str,
    *,
    intent: str,
    domain: str,
    has_data: bool,
    action_lines: list[str],
) -> str:
    lines = _clean_lines(text)
    lowered = [line.lower() for line in lines]

    if action_lines and not any(line.startswith(("recommended next steps", "action steps")) for line in lowered):
        lines.append("Recommended next steps")
        lines.extend(action_lines)

    if intent == "knowledge_query" and domain != "business_data":
        if not any(line.startswith("disclaimer") for line in lowered):
            lines.append("Disclaimer: Verify legal, tax, or compliance decisions with a qualified professional before filing or paying.")
    elif has_data:
        drill_down_line = "Check whether you want a deeper drill-down by branch, period, or transaction type."
        if drill_down_line not in lines:
            lines.append(drill_down_line)

    return "\n".join(lines).strip()


def format_chatbot_response(
    text: str,
    *,
    intent: str,
    domain: str,
    has_data: bool,
    suggestions: list[str] | None = None,
) -> str:
    if not text:
        return text

    lines = _clean_lines(text)
    action_lines = _build_action_lines(suggestions)
    if any(SECTION_RE.match(line) for line in lines):
        return _append_supporting_sections(
            text.strip(),
            intent=intent,
            domain=domain,
            has_data=has_data,
            action_lines=action_lines,
        )

    normalized_lines = [_strip_formatting(line) for line in lines]
    normalized_lines = [line for line in normalized_lines if line]

    if not normalized_lines:
        return text.strip()

    sentences = _sentence_split(" ".join(normalized_lines))
    summary = normalized_lines[0]

    bullet_candidates = []
    for line in normalized_lines[1:]:
        cleaned = _normalize_bullet(line)
        if cleaned and cleaned.lower() != summary.lower():
            bullet_candidates.append(cleaned)

    if not bullet_candidates and len(sentences) > 1:
        bullet_candidates.extend(_strip_formatting(item) for item in sentences[1:4])

    bullet_candidates = _dedupe([item for item in bullet_candidates if item])

    output = ["Summary", summary]
    if bullet_candidates:
        output.append("Key points")
        output.extend(f"- {item}" for item in bullet_candidates[:5])
    if action_lines:
        output.append("Recommended next steps")
        output.extend(action_lines)

    if intent == "knowledge_query" and domain != "business_data":
        output.append("Disclaimer: Verify legal, tax, or compliance decisions with a qualified professional before filing or paying.")
    elif has_data:
        output.append("Check whether you want a deeper drill-down by branch, period, or transaction type.")

    return "\n".join(output).strip()
