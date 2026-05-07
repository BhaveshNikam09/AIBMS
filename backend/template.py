# template.py
# AIBMS – AI-Based Business Management System (BharatSync AI)
# Run this script from your project root directory:
#   python template.py

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────
# 1. FOLDER STRUCTURE
# ─────────────────────────────────────────────
folders = [
    # Django apps
    "apps/authentication",
    "apps/users",
    "apps/business",
    "apps/branches",
    "apps/cashbook",
    "apps/documents",
    "apps/itr_analysis",
    "apps/ai_chatbot",
    "apps/reports",

    # Core config
    "config",

    # Utilities & shared code
    "utils",

    # Celery tasks (per module)
    "apps/itr_analysis/tasks",
    "apps/documents/tasks",

    # Static & media
    "static",
    "media",

    # Logs
    "logs",

    # Tests (per app)
    "tests/test_authentication",
    "tests/test_business",
    "tests/test_cashbook",
    "tests/test_documents",
    "tests/test_itr_analysis",
    "tests/test_ai_chatbot",
    "tests/test_reports",
]

# ─────────────────────────────────────────────
# 2. FILES TO CREATE (path: content)
# ─────────────────────────────────────────────
files = {
    # Root markers
    ".gitignore": """\
venv/
__pycache__/
*.pyc
*.pyo
.env
*.log
media/
staticfiles/
db.sqlite3
.DS_Store
""",

    ".env.example": """\
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Database
DB_NAME=aibms_db
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=ap-south-1

# OpenAI
OPENAI_API_KEY=

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
""",

    "manage.py": """\
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
""",

    # Config package
    "config/__init__.py": "",
    "config/urls.py": """\
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/',      include('apps.authentication.urls')),
    path('api/v1/users/',     include('apps.users.urls')),
    path('api/v1/business/',  include('apps.business.urls')),
    path('api/v1/branches/',  include('apps.branches.urls')),
    path('api/v1/cashbook/',  include('apps.cashbook.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/itr/',       include('apps.itr_analysis.urls')),
    path('api/v1/chatbot/',   include('apps.ai_chatbot.urls')),
    path('api/v1/reports/',   include('apps.reports.urls')),
]
""",
    "config/wsgi.py": """\
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_wsgi_application()
""",
    "config/asgi.py": """\
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_asgi_application()
""",
    "config/celery.py": """\
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('aibms')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
""",

    # Utils
    "utils/__init__.py": "",
    "utils/response.py": """\
from rest_framework.response import Response

def success_response(data=None, message="Success", status=200):
    return Response({"success": True, "message": message, "data": data}, status=status)

def error_response(message="Error", errors=None, status=400):
    return Response({"success": False, "message": message, "errors": errors}, status=status)
""",
    "utils/permissions.py": "# Custom DRF permissions will go here\n",
    "utils/validators.py":  "# Custom validators will go here\n",
    "utils/pagination.py": """\
from rest_framework.pagination import PageNumberPagination

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
""",

    # App __init__ files
    **{f"apps/{app}/__init__.py": "" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},

    # Stub files for each app
    **{f"apps/{app}/models.py":    f"# {app.title()} models\n" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},
    **{f"apps/{app}/serializers.py": f"# {app.title()} serializers\n" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},
    **{f"apps/{app}/views.py":    f"# {app.title()} views\n" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},
    **{f"apps/{app}/urls.py":     f"from django.urls import path\nurlpatterns = []\n" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},
    **{f"apps/{app}/admin.py":    f"from django.contrib import admin\n" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},
    **{f"apps/{app}/apps.py":     f"""\
from django.apps import AppConfig

class {app.replace('_', ' ').title().replace(' ', '')}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.{app}'
""" for app in [
        "authentication", "users", "business", "branches",
        "cashbook", "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},

    # Test stubs
    **{f"tests/test_{app}/__init__.py": "" for app in [
        "authentication", "business", "cashbook",
        "documents", "itr_analysis", "ai_chatbot", "reports"
    ]},

    # apps/__init__.py
    "apps/__init__.py": "",

    # Logs placeholder
    "logs/.gitkeep": "",
}


# ─────────────────────────────────────────────
# 3. CREATE EVERYTHING
# ─────────────────────────────────────────────
def create_structure():
    print("\n🚀 AIBMS – Scaffolding backend structure...\n")

    for folder in folders:
        full_path = os.path.join(BASE_DIR, folder)
        os.makedirs(full_path, exist_ok=True)
        print(f"  📁 Created folder: {folder}")

    for filepath, content in files.items():
        full_path = os.path.join(BASE_DIR, filepath)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, "w") as f:
                f.write(content)
            print(f"  📄 Created file:   {filepath}")
        else:
            print(f"  ⏭  Skipped (exists): {filepath}")

    print("\n✅ Scaffold complete!\n")
    print("📌 Next steps:")
    print("   1. python template.py          ← you just ran this")
    print("   2. Say 'next' → get requirements.txt")
    print("   3. pip install -r requirements.txt")
    print("   4. Continue step-by-step\n")


if __name__ == "__main__":
    create_structure()