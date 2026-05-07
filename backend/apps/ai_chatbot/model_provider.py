import logging
from typing import Callable

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _setting(name: str, default=""):
    value = getattr(settings, name, default)
    if isinstance(value, str):
        return value.strip()
    return value


def _extract_text_from_gemini(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if text.strip():
            return text.strip()
    return ""


def _extract_text_from_openai(payload: dict) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return str(message.get("content") or "").strip()


def _message_to_lines(messages: list[dict]) -> str:
    lines = []
    for message in messages:
        role = str(message.get("role") or "user").upper()
        content = str(message.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def call_api_or_local_model(
    messages: list[dict],
    system_prompt: str | None = None,
    local_fallback: Callable[[list[dict], str | None], tuple[str, int]] | None = None,
) -> dict:
    providers = []

    gemini_key = _setting("GEMINI_API_KEY", "")
    if gemini_key:
        providers.append(
            {
                "name": "gemini",
                "model": _setting("CHATBOT_GEMINI_MODEL", "gemini-2.5-flash"),
                "api_key": gemini_key,
            }
        )

    openai_key = _setting("OPENAI_API_KEY", "")
    enable_openai_fallback = str(_setting("CHATBOT_ENABLE_OPENAI_FALLBACK", "false")).lower() == "true"
    if openai_key and enable_openai_fallback:
        providers.append(
            {
                "name": "openai",
                "model": _setting("CHATBOT_OPENAI_MODEL", "gpt-4o-mini"),
                "api_key": openai_key,
            }
        )

    prompt_messages = list(messages or [])
    allow_local_fallback = str(_setting("CHATBOT_ALLOW_LOCAL_FALLBACK", "false")).lower() == "true"
    gemini_configured = any(provider["name"] == "gemini" for provider in providers)
    last_error = ""

    for provider in providers:
        try:
            if provider["name"] == "gemini":
                contents = []
                for item in prompt_messages:
                    role = "model" if item.get("role") == "assistant" else "user"
                    contents.append(
                        {
                            "role": role,
                            "parts": [{"text": str(item.get("content") or "")}],
                        }
                    )
                response = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{provider['model']}:generateContent",
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": provider["api_key"],
                    },
                    json={
                        "system_instruction": (
                            {"parts": [{"text": system_prompt}]}
                            if system_prompt else None
                        ),
                        "contents": contents,
                        "generationConfig": {
                            "temperature": 0.2,
                            "maxOutputTokens": int(_setting("CHATBOT_MAX_OUTPUT_TOKENS", 1200)),
                        },
                    },
                    timeout=int(_setting("CHATBOT_API_TIMEOUT_SECONDS", 35)),
                )
                response.raise_for_status()
                payload = response.json()
                text = _extract_text_from_gemini(payload)
                if text:
                    usage = payload.get("usageMetadata") or {}
                    tokens = int(usage.get("totalTokenCount") or usage.get("candidatesTokenCount") or 0)
                    return {
                        "text": text,
                        "tokens": tokens,
                        "model_used": provider["model"],
                        "provider": provider["name"],
                    }

            elif provider["name"] == "openai":
                openai_messages = []
                if system_prompt:
                    openai_messages.append({"role": "system", "content": system_prompt})
                openai_messages.extend(prompt_messages)
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {provider['api_key']}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": provider["model"],
                        "messages": openai_messages,
                        "temperature": 0.2,
                        "max_tokens": int(_setting("CHATBOT_MAX_OUTPUT_TOKENS", 1200)),
                    },
                    timeout=int(_setting("CHATBOT_API_TIMEOUT_SECONDS", 35)),
                )
                response.raise_for_status()
                payload = response.json()
                text = _extract_text_from_openai(payload)
                if text:
                    usage = payload.get("usage") or {}
                    tokens = int(usage.get("total_tokens") or 0)
                    return {
                        "text": text,
                        "tokens": tokens,
                        "model_used": provider["model"],
                        "provider": provider["name"],
                    }
        except Exception as exc:
            last_error = str(exc)
            logger.warning("Chatbot provider %s failed: %s", provider["name"], exc)

    if local_fallback and (allow_local_fallback or not gemini_configured):
        text, tokens = local_fallback(messages, system_prompt)
        return {
            "text": text,
            "tokens": tokens,
            "model_used": _setting("CHATBOT_LOCAL_MODEL_LABEL", "local-ollama"),
            "provider": "local",
            "error": last_error,
        }

    if gemini_configured:
        return {
            "text": (
                "I could not reach the Gemini service for this request. "
                "Please verify the API key, free-tier quota, and network access, then try again."
            ),
            "tokens": 0,
            "model_used": _setting("CHATBOT_GEMINI_MODEL", "gemini-2.5-flash"),
            "provider": "gemini",
            "error": last_error,
        }

    return {
        "text": "",
        "tokens": 0,
        "model_used": "unavailable",
        "provider": "none",
        "error": last_error,
    }
