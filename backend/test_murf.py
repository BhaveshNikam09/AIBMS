import requests
import os 
api_key = os.getenv("MURF_API_KEY")

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
