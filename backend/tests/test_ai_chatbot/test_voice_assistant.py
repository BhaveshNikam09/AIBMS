import ast
import os
import sys
import types
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4


def _load_voice_namespace():
    services_path = Path(__file__).resolve().parents[2] / "apps" / "ai_chatbot" / "voice_services.py"
    source = services_path.read_text(encoding="utf-8")
    module = ast.parse(source)

    keep = []
    wanted_assignments = {
        "DEFAULT_VOICE_ID",
        "WAKE_PREFIXES",
        "BRIEFING_PHRASES",
        "SUMMARY_PHRASES",
        "BRANCH_PHRASES",
        "DUE_PHRASES",
        "AMOUNT_RE",
        "BRANCH_CRUD_PHRASES",
        "ENTRY_TRIGGER_RE",
        "VOICE_SPEECH_MAX_CHARS",
        "SUMMARY_DOMAIN",
        "INSIGHT_DOMAIN",
    }
    wanted_functions = {
        "_greeting_for_now",
        "_normalize_text",
        "strip_wake_phrase",
        "classify_voice_request",
        "format_structured_response",
        "make_voice_friendly_text",
        "build_wake_greeting_payload",
        "handle_voice_assistant_request",
    }

    for node in module.body:
        if isinstance(node, ast.Assign):
            target_names = {
                target.id
                for target in node.targets
                if isinstance(target, ast.Name)
            }
            if target_names & wanted_assignments:
                keep.append(node)
        elif isinstance(node, ast.FunctionDef) and node.name in wanted_functions:
            keep.append(node)

    mini_module = ast.Module(body=keep, type_ignores=[])

    class FakeChatIntent:
        GENERAL = "general"
        DATA_QUERY = "data_query"
        BUSINESS_INSIGHT = "business_insight"
        values = [GENERAL, DATA_QUERY, BUSINESS_INSIGHT]

    class FakeKnowledgeDomain:
        GENERAL = "general"
        BUSINESS_DATA = "business_data"
        BUSINESS_INSIGHTS = "business_insights"
        values = [GENERAL, BUSINESS_DATA, BUSINESS_INSIGHTS]

    namespace = {
        "re": __import__("re"),
        "time": __import__("time"),
        "tempfile": __import__("tempfile"),
        "uuid": __import__("uuid"),
        "Path": Path,
        "Iterable": __import__("typing").Iterable,
        "timezone": SimpleNamespace(
            datetime=datetime,
            now=lambda: datetime(2026, 4, 17, 9, 0, 0),
            localtime=lambda value=None: value or datetime(2026, 4, 17, 9, 0, 0),
        ),
        "ChatIntent": FakeChatIntent,
        "KnowledgeDomain": FakeKnowledgeDomain,
        "settings": SimpleNamespace(
            BASE_DIR=Path(__file__).resolve().parents[2],
            MURF_VOICE_ID="en-US-amara",
        ),
        "logger": SimpleNamespace(
            warning=lambda *args, **kwargs: None,
            error=lambda *args, **kwargs: None,
            info=lambda *args, **kwargs: None,
        ),
    }

    exec(compile(mini_module, str(services_path), "exec"), namespace)
    namespace["FakeChatIntent"] = FakeChatIntent
    namespace["FakeKnowledgeDomain"] = FakeKnowledgeDomain
    return namespace


def _install_business_view_stub(get_business_or_error):
    stub = types.ModuleType("apps.business.views")
    stub.get_business_or_error = get_business_or_error
    sys.modules["apps.business.views"] = stub


def test_voice_wake_phrase_and_classification_helpers():
    ns = _load_voice_namespace()

    cleaned, wake_only = ns["strip_wake_phrase"]("hey buddy what is my total profit")

    assert cleaned == "what is my total profit"
    assert wake_only is True
    assert ns["classify_voice_request"]("branch with highest profit") == "branch_summary"
    assert ns["classify_voice_request"]("what are the payable and receivable") == "due_summary"
    assert ns["classify_voice_request"]("good morning") == "briefing"


def test_make_voice_friendly_text_compacts_structured_output():
    ns = _load_voice_namespace()
    text = "\n".join(
        [
            "Summary",
            "Acme Foods has ₹73,900 income and ₹16,496 expenses this month.",
            "Key points",
            "- Profit margin is 77.7%.",
            "- Pending receivables total ₹4,000.",
            "Recommended next steps",
            "Review the top expense driver before the next payout cycle.",
            "Disclaimer: This is based on confirmed cashbook entries.",
        ]
    )

    speech = ns["make_voice_friendly_text"](text)

    assert "Summary" not in speech
    assert "Recommended next steps" not in speech
    assert "Disclaimer" not in speech
    assert "Acme Foods" in speech


def test_voice_briefing_path_uses_deterministic_briefing(monkeypatch):
    ns = _load_voice_namespace()

    user = SimpleNamespace(full_name="Akash", email="akash@example.com")
    business = SimpleNamespace(name="Acme Foods")
    session = SimpleNamespace(id=uuid4(), business_id="biz-1", title="", save=lambda **kwargs: None)
    captured = {}

    def fake_get_business_or_error(pk, _user):
        return business, None

    def fake_resolve_session(_user, _business_id, session_id=None, create_if_missing=True):
        return session

    def fake_briefing_payload(user_name, business_name, business_id):
        return {
            "intent": ns["FakeChatIntent"].BUSINESS_INSIGHT,
            "domain": ns["FakeKnowledgeDomain"].BUSINESS_INSIGHTS,
            "session_title": "Morning briefing",
            "response_text": f"Summary\nGood morning {user_name}. {business_name} is performing well.",
            "speech_text": f"Good morning {user_name}. {business_name} is performing well.",
            "query_result": {"snapshot": {"profit": 25000}},
            "has_data": True,
        }

    def fake_persist_voice_exchange(**kwargs):
        captured.update(kwargs)
        return (SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4()))

    _install_business_view_stub(fake_get_business_or_error)
    monkeypatch.setitem(ns, "resolve_voice_session", fake_resolve_session)
    monkeypatch.setitem(ns, "build_briefing_payload", fake_briefing_payload)
    monkeypatch.setitem(ns, "generate_murf_audio_file", lambda *args, **kwargs: "http://audio.test/briefing.mp3")
    monkeypatch.setitem(ns, "_persist_voice_exchange", fake_persist_voice_exchange)

    result = ns["handle_voice_assistant_request"](
        user=user,
        business_id="biz-1",
        session_id=None,
        mode="briefing",
        text="hey buddy",
        voice_id="en-US-amara",
        request=SimpleNamespace(),
    )

    assert result["voice_mode"] == "briefing"
    assert result["audio_url"] == "http://audio.test/briefing.mp3"
    assert result["transcript"] == "hey buddy"
    assert captured["session_title"] == "Morning briefing"
    assert captured["intent"] == ns["FakeChatIntent"].BUSINESS_INSIGHT
    assert captured["domain"] == ns["FakeKnowledgeDomain"].BUSINESS_INSIGHTS


def test_voice_command_path_uses_chatbot_fallback(monkeypatch):
    ns = _load_voice_namespace()

    user = SimpleNamespace(full_name="Akash", email="akash@example.com")
    session = SimpleNamespace(id=uuid4(), business_id="biz-1", title="Voice session", save=lambda **kwargs: None)
    business = SimpleNamespace(name="Acme Foods")
    captured = {}

    def fake_get_business_or_error(pk, _user):
        return business, None

    def fake_resolve_session(_user, _business_id, session_id=None, create_if_missing=True):
        return session

    def fake_build_chatbot_voice_payload(**kwargs):
        captured.update(kwargs)
        return {
            "mode": "chat",
            "intent": ns["FakeChatIntent"].GENERAL,
            "domain": ns["FakeKnowledgeDomain"].GENERAL,
            "response_text": "Summary\nDone.",
            "speech_text": "Done.",
            "audio_url": "http://audio.test/chat.mp3",
            "session_id": str(session.id),
            "model_used": "gemini",
            "has_data": False,
            "query_result": {},
            "processing_time": 1.2,
            "tokens_used": 12,
        }

    _install_business_view_stub(fake_get_business_or_error)
    monkeypatch.setitem(ns, "resolve_voice_session", fake_resolve_session)
    monkeypatch.setitem(ns, "build_chatbot_voice_payload", fake_build_chatbot_voice_payload)

    result = ns["handle_voice_assistant_request"](
        user=user,
        business_id="biz-1",
        session_id=None,
        mode="command",
        text="hey buddy explain gst composition scheme",
        voice_id="en-US-amara",
        request=SimpleNamespace(),
    )

    assert result["voice_mode"] == "command"
    assert result["audio_url"] == "http://audio.test/chat.mp3"
    assert result["transcript"] == "hey buddy explain gst composition scheme"
    assert captured["user_message"] == "explain gst composition scheme"
    assert captured["business_id"] == "biz-1"


def test_wake_only_voice_request_returns_greeting_without_business(monkeypatch):
    ns = _load_voice_namespace()

    user = SimpleNamespace(full_name="Akash", email="akash@example.com")
    session = SimpleNamespace(id=uuid4(), business_id=None, title="", save=lambda **kwargs: None)
    captured = {}

    def fake_resolve_session(_user, _business_id, session_id=None, create_if_missing=True):
        return session

    def fake_persist_voice_exchange(**kwargs):
        captured.update(kwargs)
        return (SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4()))

    _install_business_view_stub(lambda pk, _user: (None, None))
    monkeypatch.setitem(ns, "resolve_voice_session", fake_resolve_session)
    monkeypatch.setitem(ns, "generate_murf_audio_file", lambda *args, **kwargs: "http://audio.test/wake.mp3")
    monkeypatch.setitem(ns, "_persist_voice_exchange", fake_persist_voice_exchange)

    result = ns["handle_voice_assistant_request"](
        user=user,
        business_id=None,
        session_id=None,
        mode="command",
        text="hey buddy",
        voice_id="Anisha",
        request=SimpleNamespace(),
    )

    assert result["audio_url"] == "http://audio.test/wake.mp3"
    assert result["voice_mode"] == "summary"
    assert "I am listening" in result["speech_text"]
    assert captured["intent"] == ns["FakeChatIntent"].GENERAL
