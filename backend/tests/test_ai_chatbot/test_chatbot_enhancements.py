import ast
import os
import sys
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from apps.ai_chatbot import model_provider
from apps.ai_chatbot.action_handlers import parse_management_action
from apps.ai_chatbot.model_provider import call_api_or_local_model
from apps.ai_chatbot.prompt_builder import (
    BusinessContext,
    build_clarifying_response,
    build_follow_up_suggestions,
    detect_aggregate_scope,
    is_unclear_message,
)
from apps.ai_chatbot.response_formatter import format_chatbot_response


def _load_services_helpers():
    services_path = Path(__file__).resolve().parents[2] / "apps" / "ai_chatbot" / "services.py"
    source = services_path.read_text(encoding="utf-8")
    module = ast.parse(source)
    keep = []
    for node in module.body:
        if isinstance(node, ast.Assign):
            target_names = {
                target.id
                for target in node.targets
                if isinstance(target, ast.Name)
            }
            if target_names & {
                "_AMOUNT_PATTERNS",
                "_FILLER_WORDS",
                "_GENERIC_DESCRIPTION_KEYWORDS",
                "_NOISE_DESCRIPTION_TOKENS",
                "_SHORT_DESCRIPTION_KEEP",
                "_PAYMENT_MODE_PATTERNS",
                "_PAYMENT_MODE_DISPLAY",
                "_MONEY_LABELS",
                "_PRODUCT_LABELS",
                "CATEGORY_MAP",
                "INCOME_CATEGORY_MAP",
            }:
                keep.append(node)

        if isinstance(node, ast.FunctionDef) and node.name in {
            "_estimate_income_tax",
            "_top_entries_text",
            "_template_data_response",
            "_is_branch_breakdown_request",
            "_has_explicit_period_reference",
            "_is_business_aware_tax_question",
            "_is_entry_review_request",
            "_latest_user_message",
            "_build_entry_review_response",
            "_structured_knowledge_response",
            "_render_business_aware_tax_response",
            "_inr_value",
            "_is_greeting",
            "_normalize_description_text",
            "_strip_payment_mode_terms",
            "_tokenize_description_text",
            "_format_description_text",
            "_cleanup_description_text",
            "_extract_specific_description_from_catalog",
            "_regex_parse_amount",
            "_regex_parse_description",
            "_fuzzy_match_category",
            "parse_amount",
            "parse_description",
            "parse_payment_mode",
            "format_payment_mode",
            "detect_category",
            "smart_expense_parser",
            "detect_intent",
        }:
            keep.append(node)

    mini_module = ast.Module(body=keep, type_ignores=[])
    namespace = {
        "re": __import__("re"),
        "unicodedata": __import__("unicodedata"),
        "TOP_ENTRIES_COUNT": 5,
        "_ADVANCE_TAX_SCHEDULE": {
            'Q1': ('15 June', 15),
            'Q2': ('15 September', 45),
            'Q3': ('15 December', 75),
            'Q4': ('15 March', 100),
        },
        "KNOWLEDGE_KEYWORDS": {"tax", "gst", "calculate", "deduction"},
        "WRITE_KEYWORDS": {"add", "record", "create"},
        "INCOME_KEYWORDS": {"income", "credit", "sales"},
        "EXPENSE_KEYWORDS": {"expense", "debit", "paid"},
        "MANAGE_KEYWORDS": {"access", "permission", "role", "staff", "manager", "team"},
        "BRANCH_KEYWORDS": {"create branch", "add branch", "new branch", "branch access"},
        "DATA_KEYWORDS": {"profit", "loss", "income", "expenses", "branch", "balance", "entries", "show"},
        "EDIT_KEYWORDS": {"edit", "update", "change", "modify"},
        "DELETE_KEYWORDS": {"delete", "remove", "cancel entry", "erase"},
        "TREND_KEYWORDS": {"trend", "last 6 months"},
        "ALERT_KEYWORDS": {"alert", "warning"},
        "COMPARE_KEYWORDS": {"compare", "highest profit", "branch with highest profit"},
        "DOCUMENT_KEYWORDS": {"document", "invoice"},
        "INSIGHT_KEYWORDS": {"insight", "analysis"},
        "REPORT_KEYWORDS": {"report", "generate report"},
        "CONFIRMATION_KEYWORDS": {"yes", "confirm", "okay"},
        "CANCELLATION_KEYWORDS": {"no", "cancel", "stop"},
        "GREETING_KEYWORDS": {"hi", "hello", "hey"},
        "NLP_AVAILABLE": False,
        "FUZZY_AVAILABLE": False,
        "FUZZY_THRESHOLD": 90,
        "_fuzz": None,
        "_CATEGORY_FLAT_KEYWORDS": {},
        "_INCOME_FLAT_KEYWORDS": {},
        "_get_ci": lambda: None,
    }
    exec(compile(mini_module, str(services_path), "exec"), namespace)
    return namespace


def test_unclear_message_detection_handles_short_ambiguous_inputs():
    assert is_unclear_message("help") is True
    assert is_unclear_message("why") is True
    assert is_unclear_message("show profit for March") is False


def test_delete_command_is_not_misclassified_as_greeting():
    helpers = _load_services_helpers()

    assert helpers["detect_intent"]("delete the entry") == "write_action"
    assert helpers["detect_intent"]("edit the entry") != "greeting"


def test_clarifying_response_mentions_business_context():
    context = BusinessContext(business_name="Acme Foods", role="accountant")

    text = build_clarifying_response("help", context)

    assert "Acme Foods" in text
    assert "Accountant-focused" in text
    assert "Check cash flow or profit" in text


def test_follow_up_suggestions_use_role_and_intent_context():
    context = BusinessContext(role="business_owner")

    suggestions = build_follow_up_suggestions("data_query", "business_data", context)

    assert any("expense drivers" in item.lower() for item in suggestions)
    assert any("branch profitability" in item.lower() for item in suggestions)


def test_formatter_adds_structure_and_disclaimer_for_knowledge_answers():
    text = "GST registration is required once your turnover crosses the threshold. Voluntary registration is also possible."

    formatted = format_chatbot_response(
        text,
        intent="knowledge_query",
        domain="gst_indirect_taxes",
        has_data=False,
        suggestions=["Review whether this affects your next GST filing."],
    )

    assert formatted.startswith("Summary")
    assert "Key points" in formatted
    assert "Disclaimer:" in formatted
    assert "Review whether this affects your next GST filing." in formatted


def test_formatter_enriches_already_structured_content_when_sections_are_missing():
    text = "Summary\nAlready structured"

    formatted = format_chatbot_response(
        text,
        intent="knowledge_query",
        domain="general",
        has_data=False,
        suggestions=["Review the filing window."],
    )

    assert formatted.startswith(text)
    assert "Recommended next steps" in formatted
    assert "Review the filing window." in formatted
    assert "Disclaimer:" in formatted


def test_total_profit_queries_use_overall_scope():
    assert detect_aggregate_scope("what is my total profit") == "overall"
    assert detect_aggregate_scope("show my overall income") == "overall"
    assert detect_aggregate_scope("show profit this month") == "current_period"


def test_current_scope_overrides_total_when_message_mentions_current_period():
    assert detect_aggregate_scope("my total tax payable on my current income") == "current_period"
    assert detect_aggregate_scope("show my total income this month") == "current_period"


def test_top_entries_text_returns_clean_bullet_lines():
    helpers = _load_services_helpers()

    text = helpers["_top_entries_text"]([
        {"amount": 1000.0, "party_name": "akash", "description": ""},
        {"amount": 2500.0, "party_name": "walkin", "description": "counter sale"},
    ])

    assert "Top entries:" not in text
    assert "- akash: ₹1,000.00" in text
    assert "- counter sale: ₹2,500.00" in text


def test_description_parser_prefers_specific_item_over_generic_words():
    helpers = _load_services_helpers()

    assert helpers["parse_description"]("ADD 500 FOT EH FUEL FOR TRAVEL") == "Fuel"
    assert helpers["parse_description"]("Paid 1200 office rent") == "Office Rent"


def test_smart_expense_parser_keeps_specific_description_and_correct_category():
    helpers = _load_services_helpers()

    parsed = helpers["smart_expense_parser"]("ADD 500 FOT EH FUEL FOR TRAVEL")

    assert parsed["amount"] == 500.0
    assert parsed["description"] == "Fuel"
    assert parsed["category"] == "Travel"
    assert parsed["payment_mode"] == "cash"


def test_payment_mode_parser_extracts_mode_without_polluting_description():
    helpers = _load_services_helpers()

    parsed = helpers["smart_expense_parser"]("add 500 fuel via upi for travel")

    assert parsed["amount"] == 500.0
    assert parsed["description"] == "Fuel"
    assert parsed["category"] == "Travel"
    assert parsed["payment_mode"] == "upi"


def test_payment_mode_parser_supports_bank_transfer_aliases():
    helpers = _load_services_helpers()

    assert helpers["parse_payment_mode"]("record 4500 salary via bank transfer") == "bank_transfer"
    assert helpers["parse_payment_mode"]("received 12000 by neft from client") == "bank_transfer"


def test_income_template_uses_tax_summary_for_tax_estimate_queries():
    helpers = _load_services_helpers()

    text = helpers["_template_data_response"]({
        "type": "income",
        "period": "this month",
        "total_income": 73900.0,
        "entry_count": 10,
        "top_entries": [],
        "tax_estimate": helpers["_estimate_income_tax"](73900.0),
    })

    assert text.startswith("Summary")
    assert "Estimated income tax on the selected this month income" in text
    assert "Recommended next steps" in text
    assert "gross income" in text


def test_branch_breakdown_detection_handles_branch_wise_queries():
    helpers = _load_services_helpers()

    assert helpers["_is_branch_breakdown_request"]("waht branch wise profit i make") is True
    assert helpers["_is_branch_breakdown_request"]("show me profit of nashik branch") is False
    assert helpers["_has_explicit_period_reference"]("branch wise profit last month") is True
    assert helpers["_has_explicit_period_reference"]("branch wise profit i make") is False


def test_management_parser_detects_branch_and_staff_commands():
    branch_action = parse_management_action(
        "Create branch Nashik West in Nashik city",
        "biz-1",
    )
    assert branch_action["mode"] == "action"
    assert branch_action["action_type"] == "create_branch"
    assert branch_action["branch_name"] == "Nashik West"

    member_action = parse_management_action(
        "Create staff Rahul Patil rahul@example.com as accountant for Nashik branch",
        "biz-1",
    )
    assert member_action["mode"] == "action"
    assert member_action["action_type"] == "create_member"
    assert member_action["email"] == "rahul@example.com"
    assert member_action["role"] == "accountant"
    assert member_action["branch_reference"] == "Nashik"


def test_management_parser_detects_access_and_role_changes():
    grant_action = parse_management_action(
        "Grant access to rahul@example.com for Nashik branch as accountant",
        "biz-1",
    )
    assert grant_action["mode"] == "action"
    assert grant_action["action_type"] == "grant_access"
    assert grant_action["branch_reference"] == "Nashik"

    role_action = parse_management_action(
        "Make rahul@example.com accountant for Nashik branch",
        "biz-1",
    )
    assert role_action["mode"] == "action"
    assert role_action["action_type"] == "change_role"
    assert role_action["role"] == "accountant"

    revoke_action = parse_management_action(
        "Remove rahul@example.com from Nashik branch",
        "biz-1",
    )
    assert revoke_action["mode"] == "action"
    assert revoke_action["action_type"] == "revoke_access"
    assert revoke_action["branch_reference"] == "Nashik"


def test_management_parser_detects_branch_updates_and_member_status_changes():
    update_action = parse_management_action(
        "Rename Nashik branch to Nashik West and change city to Pune",
        "biz-1",
    )
    assert update_action["mode"] == "action"
    assert update_action["action_type"] == "update_branch"
    assert update_action["branch_reference"] == "Nashik"
    assert update_action["updates"]["name"] == "Nashik West"
    assert update_action["updates"]["city"] == "Pune"

    deactivate_action = parse_management_action(
        "Deactivate Rahul Patil for Nashik branch",
        "biz-1",
    )
    assert deactivate_action["mode"] == "action"
    assert deactivate_action["action_type"] == "toggle_member_status"
    assert deactivate_action["target_status"] == "inactive"
    assert deactivate_action["branch_reference"] == "Nashik"

    activate_action = parse_management_action(
        "Enable Rahul Patil",
        "biz-1",
    )
    assert activate_action["mode"] == "action"
    assert activate_action["action_type"] == "toggle_member_status"
    assert activate_action["target_status"] == "active"


def test_business_aware_tax_question_detection_and_rendering():
    helpers = _load_services_helpers()

    assert helpers["_is_business_aware_tax_question"]("what scheme can i claim") is True
    assert helpers["_is_business_aware_tax_question"]("calculate my advance tax for q4") is True
    assert helpers["_is_business_aware_tax_question"]("explain gst composition scheme") is False

    scheme_text = helpers["_render_business_aware_tax_response"](
        "what scheme can i claim",
        {
            "business_name": "Acme Foods",
            "period": "this year",
            "yearly_income": 900000.0,
            "yearly_expense": 350000.0,
            "yearly_profit": 550000.0,
            "overall_profit": 700000.0,
            "tax_estimate": helpers["_estimate_income_tax"](550000.0),
            "composition_candidate": True,
            "presumptive_candidate": True,
            "rebate_candidate": True,
        },
    )
    assert scheme_text.startswith("Summary")
    assert "Section 44AD" in scheme_text
    assert "Recommended next steps" in scheme_text

    advance_tax_text = helpers["_render_business_aware_tax_response"](
        "calculate my advance tax for q4",
        {
            "business_name": "Acme Foods",
            "period": "this year",
            "yearly_income": 1200000.0,
            "yearly_expense": 400000.0,
            "yearly_profit": 800000.0,
            "overall_profit": 900000.0,
            "tax_estimate": helpers["_estimate_income_tax"](800000.0),
            "composition_candidate": True,
            "presumptive_candidate": True,
            "rebate_candidate": False,
        },
    )
    assert "Q4" in advance_tax_text
    assert "15 March" in advance_tax_text
    assert "estimated tax" in advance_tax_text.lower()

    zero_tax_text = helpers["_render_business_aware_tax_response"](
        "calculate my advance tax for q4",
        {
            "business_name": "co",
            "period": "year 2026",
            "yearly_income": 73900.0,
            "yearly_expense": 16496.0,
            "yearly_profit": 57404.0,
            "overall_profit": 57404.0,
            "tax_estimate": helpers["_estimate_income_tax"](57404.0),
            "composition_candidate": True,
            "presumptive_candidate": True,
            "rebate_candidate": True,
        },
    )
    assert "no advance tax is currently payable" in zero_tax_text.lower()
    assert "your business" in zero_tax_text.lower()
    assert "below the first slab threshold" in zero_tax_text.lower()
    assert "15 March" in zero_tax_text


def test_entry_review_shortcut_returns_concise_parse_summary():
    helpers = _load_services_helpers()

    history = [
        {"role": "user", "content": "ADD 500 FOT EH FUEL FOR TRAVEL"},
        {"role": "assistant", "content": "✅ Entry detected — please confirm:"},
        {"role": "user", "content": "readd this"},
    ]

    assert helpers["_is_entry_review_request"]("readd this") is True
    assert helpers["_latest_user_message"](history) == "ADD 500 FOT EH FUEL FOR TRAVEL"

    text = helpers["_build_entry_review_response"]("readd this", history)

    assert text.startswith("Summary")
    assert "Parsed entry summary" in text
    assert "Fuel" in text
    assert "₹500" in text
    assert "Travel" in text
    assert "GST" not in text
    assert "Section 37" not in text


def test_follow_up_suggestions_add_tax_and_compliance_guidance_for_knowledge_queries():
    context = BusinessContext(role="business_owner")
    suggestions = build_follow_up_suggestions("knowledge_query", "general", context)

    assert any("turnover" in item.lower() for item in suggestions)
    assert any("44ad" in item.lower() or "gst composition" in item.lower() for item in suggestions)


def test_follow_up_suggestions_add_admin_actions_for_manage_access():
    context = BusinessContext(role="manager")
    suggestions = build_follow_up_suggestions("manage_access", "general", context)

    assert any("branch" in item.lower() for item in suggestions)
    assert any("staff" in item.lower() for item in suggestions)


def test_model_provider_falls_back_to_local_callback_when_no_api_keys(monkeypatch):
    monkeypatch.setattr(
        model_provider,
        "_setting",
        lambda name, default="": {
            "GEMINI_API_KEY": "",
            "OPENAI_API_KEY": "",
        }.get(name, default),
    )

    result = call_api_or_local_model(
        messages=[{"role": "user", "content": "Hello"}],
        system_prompt="You are helpful.",
        local_fallback=lambda messages, prompt: ("local reply", 11),
    )

    assert result["text"] == "local reply"
    assert result["tokens"] == 11
    assert result["provider"] == "local"


def test_model_provider_does_not_silently_fallback_when_gemini_is_configured(monkeypatch):
    def fake_setting(name, default=""):
        values = {
            "GEMINI_API_KEY": "test-key",
            "CHATBOT_GEMINI_MODEL": "gemini-2.5-flash",
            "CHATBOT_ALLOW_LOCAL_FALLBACK": "false",
            "CHATBOT_API_TIMEOUT_SECONDS": 1,
            "CHATBOT_MAX_OUTPUT_TOKENS": 700,
            "OPENAI_API_KEY": "",
        }
        return values.get(name, default)

    class FakeResponse:
        def raise_for_status(self):
            raise RuntimeError("401 invalid key")

    monkeypatch.setattr(model_provider, "_setting", fake_setting)
    monkeypatch.setattr(model_provider.requests, "post", lambda *args, **kwargs: FakeResponse())

    result = call_api_or_local_model(
        messages=[{"role": "user", "content": "Hello"}],
        system_prompt="You are helpful.",
        local_fallback=lambda messages, prompt: ("local reply", 11),
    )

    assert result["provider"] == "gemini"
    assert "could not reach the Gemini service" in result["text"]
