import logging
from django.utils import timezone
from .models import PendingAction

logger = logging.getLogger(__name__)

def calculate_tax_liability(taxable_income, is_new_regime=True):
    slabs = [
        (400000, 0.0),
        (400000, 0.05),
        (400000, 0.10),
        (400000, 0.15),
        (400000, 0.20),
        (400000, 0.25),
    ]
    
    tax = 0.0
    remaining = taxable_income
    breakdown = []
    
    lower_bound = 0
    for slab_limit, rate in slabs:
        upper_bound = lower_bound + slab_limit
        if remaining > 0:
            taxable_in_slab = min(remaining, slab_limit)
            slab_tax = taxable_in_slab * rate
            tax += slab_tax
            breakdown.append(f"{lower_bound if lower_bound == 0 else lower_bound+1:,} - {upper_bound:,} → ₹{slab_tax:,.0f}")
            remaining -= taxable_in_slab
        lower_bound = upper_bound
        
    if remaining > 0:
        slab_tax = remaining * 0.30
        tax += slab_tax
        breakdown.append(f"Above 24,00,000 → ₹{slab_tax:,.0f}")
        
    rebate_applicable = False
    rebate_limit = 1200000 if is_new_regime else 500000
    
    if taxable_income <= rebate_limit:
        rebate_applicable = True
        tax = 0.0
        
    return tax, breakdown, rebate_applicable


def calculate_tax_breakdown(data, regime="compare"):
    income = float(data.get('income', 0))
    expenses = float(data.get('expenses', 0))
    depreciation = float(data.get('depreciation') or 0)
    interest = float(data.get('interest') or 0)
    bad_debts = float(data.get('bad_debts') or 0)
    other_deductions = float(data.get('other_deductions') or 0)
    
    # CALCULATIONS
    taxable_old = max(0, income - expenses - depreciation - interest - bad_debts - other_deductions)
    tax_old, breakdown_old, rebate_old = calculate_tax_liability(taxable_old, is_new_regime=False)
    
    taxable_new = max(0, income - expenses)
    tax_new, breakdown_new, rebate_new = calculate_tax_liability(taxable_new, is_new_regime=True)
    
    # 1. HEADER & INPUTS
    response = "📊 Tax Calculation Summary\n\n"
    response += f"Income (from system): ₹{income:,.2f}\n"
    response += f"Expenses (from system): ₹{expenses:,.2f}\n\n"
    
    response += "Additional Inputs:\n"
    response += f"✔ Depreciation: ₹{depreciation:,.2f}\n"
    response += f"✔ Loan Interest: ₹{interest:,.2f}\n"
    response += f"✔ Bad Debts: ₹{bad_debts:,.2f}\n"
    response += f"✔ Other Deductions: ₹{other_deductions:,.2f}\n\n"
    response += "----------------------------------------\n\n"
    
    # 2. REGIME DETAILS
    def format_regime_block(name, taxable, tax, breakdown, rebate, is_new=False):
        block = f"🧾 Selected Regime: {name}\n\n"
        if is_new:
            block += "Note: Additional deductions are not applicable under New Regime\n\n"
        
        block += f"Taxable Income: ₹{taxable:,.2f}\n\n"
        block += "📉 Tax Breakdown (MANDATORY):\n"
        block += "\n".join(breakdown) + "\n\n"
        block += f"Total Tax Payable: ₹{tax:,.2f}\n\n"
        
        rebate_limit_str = "₹12,00,000" if is_new else "₹5,00,000"
        
        block += "⚠ Section 87A Rebate:\n"
        if rebate:
            block += f"Applicable (Taxable income ≤ {rebate_limit_str})\n"
        else:
            block += f"Not Applicable (Taxable income > {rebate_limit_str})\n"
        return block

    if regime == "old":
        response += format_regime_block("Old", taxable_old, tax_old, breakdown_old, rebate_old, False)
    elif regime == "new":
        response += format_regime_block("New", taxable_new, tax_new, breakdown_new, rebate_new, True)
    else:
        # Compare mode
        response += format_regime_block("Old", taxable_old, tax_old, breakdown_old, rebate_old, False)
        response += "\n----------------------------------------\n\n"
        response += format_regime_block("New", taxable_new, tax_new, breakdown_new, rebate_new, True)

    response += "\n----------------------------------------\n\n"
    
    # 3. SMART SUGGESTIONS
    response += "💡 Smart Suggestions (MANDATORY):\n"
    
    if tax_old < tax_new:
        savings = tax_new - tax_old
        response += f"• Suggestion: Choose the Old Regime to save ₹{savings:,.2f} in taxes.\n"
    elif tax_new < tax_old:
        savings = tax_old - tax_new
        response += f"• Suggestion: Choose the New Regime to save ₹{savings:,.2f} in taxes.\n"
    else:
        response += "• Suggestion: Both regimes result in the exact same tax liability. The New Regime is recommended due to less compliance and paperwork.\n"
        
    total_deductions = depreciation + interest + bad_debts + other_deductions
    if regime != "old" and total_deductions > 0 and tax_new <= tax_old:
        response += f"• Highlight: You have ₹{total_deductions:,.2f} in unused deductions under the New Regime. However, New Regime is still better or equal.\n"
    
    if tax_new > 0 or tax_old > 0:
        response += "• Tips to Reduce Tax: Consider maximizing Section 80C investments, medical insurance (80D), or upgrading business assets to claim higher depreciation.\n"

    return response


def handle_tax_calculation_step(user_message, pending_action):
    from .services import parse_amount
    
    data = pending_action.action_data
    step = data.get('step', 1)
    
    msg_lower = user_message.lower().strip()
    
    # Check for cancellation
    strict_cancel_keywords = ['cancel', 'stop', 'abort', 'exit', 'quit', 'chhoddo', 'band karo']
    if any(kw in msg_lower for kw in strict_cancel_keywords) and len(msg_lower.split()) < 4:
        pending_action.status = PendingAction.Status.CANCELLED
        pending_action.save(update_fields=['status'])
        return "Tax calculation cancelled. Let me know if you need help with anything else!"
    
    response_text = ""
    
    no_keywords = ['no', 'none', 'zero', 'nahi', 'nothing']
    def is_no(msg):
        if msg == '0': return True
        words = msg.split()
        return len(words) <= 3 and any(k in words for k in no_keywords)

    if step == 1:
        amount = 0.0 if is_no(msg_lower) else parse_amount(user_message)
        data['depreciation'] = amount
        data['step'] = 2
        response_text = f"✔ Depreciation Recorded: ₹{amount:,.0f}\n\n2. Do you have any business loan interest paid? (Reply with amount or 'No')"
        
    elif step == 2:
        amount = 0.0 if is_no(msg_lower) else parse_amount(user_message)
        data['interest'] = amount
        data['step'] = 3
        response_text = f"✔ Loan Interest Recorded: ₹{amount:,.0f}\n\n3. Any bad debts written off this year? (Reply with amount or 'No')"
        
    elif step == 3:
        amount = 0.0 if is_no(msg_lower) else parse_amount(user_message)
        data['bad_debts'] = amount
        data['step'] = 4
        response_text = f"✔ Bad Debts Recorded: ₹{amount:,.0f}\n\n4. Any other deductions or expenses not already recorded? (Reply with amount or 'No')"
        
    elif step == 4:
        amount = 0.0 if is_no(msg_lower) else parse_amount(user_message)
        data['other_deductions'] = amount
        data['step'] = 5
        response_text = f"✔ Other Deductions Recorded: ₹{amount:,.0f}\n\n5. Which tax regime do you prefer?\n- Old\n- New\n- Not sure (compare both)"
        
    elif step == 5:
        regime = "compare"
        if "old" in msg_lower:
            regime = "old"
        elif "new" in msg_lower:
            regime = "new"
            
        data['regime'] = regime
        response_text = calculate_tax_breakdown(data, regime)
        pending_action.status = PendingAction.Status.CONFIRMED
        
    pending_action.action_data = data
    pending_action.save(update_fields=['action_data', 'status'])
    
    return response_text
