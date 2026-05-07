import requests

api_key = "ap2_5e914c44-8bdd-4a63-81c5-484babf71a86"

url = "https://api.murf.ai/v1/speech/voices"
headers = {
    "api-key": api_key,
    "Accept": "application/json"
}

res = requests.get(url, headers=headers)
data = res.json()
voices = []
for v in data:
    if "anisha" in v.get("voiceId", "").lower() or "anisha" in v.get("displayName", "").lower():
        voices.append(v)
    elif "en-IN" in v.get("voiceId", ""):
        voices.append(v)
        
for v in voices:
    print(v)
