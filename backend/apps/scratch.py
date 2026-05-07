import re

def extract_voice_amount(text: str):
    text = re.sub(r'(\d),(\d)', r'\1\2', text.lower())
    pattern = r'(\d+(?:\.\d+)?)\s*(lakhs?|crores?|thousands?|hundreds?|k|m|cr)?'
    
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

tests = [
    "1 lakh 90 thousand salary paid",
    "add 500 fuel expense by upi",
    "1.5 lakh received",
    "20k salary",
    "1cr investment",
    "1,00,000 received",
    "add 500 for bill 123",
    "add 1 lakh and 50 thousand",
    "one lakh 90 thousand", # Ah, text numbers like "one" won't match (\d+)
]

for t in tests:
    print(f"'{t}' -> {extract_voice_amount(t)}")
