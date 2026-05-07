import os
import sys
import django

sys.path.append('d:/Challenges/aibms/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.ai_chatbot.voice_services import classify_voice_request, parse_voice_entry, INCOME_SIGNALS

text = "10 lakh service income"
print("classify:", classify_voice_request(text))
print("parse:", parse_voice_entry(text))

text2 = "add 10 lakh service income"
print("classify 2:", classify_voice_request(text2))
print("parse 2:", parse_voice_entry(text2))

