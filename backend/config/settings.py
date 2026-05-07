# config/settings.py
# AIBMS – BharatSync AI
# Central Django Settings File

import os
from pathlib import Path
from datetime import timedelta
from decouple import config

# ─────────────────────────────────────────────
# BASE DIRECTORY
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

ALLOWED_HOSTS = ['*']
# ─────────────────────────────────────────────
# SECURITY
# ─────────────────────────────────────────────
SECRET_KEY = config('SECRET_KEY', default='change-me-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='127.0.0.1,localhost').split(',')

GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
ASSEMBLYAI_API_KEY = config('ASSEMBLYAI_API_KEY', default='')
MURF_API_KEY = config('MURF_API_KEY', default='')
MURF_VOICE_ID = config('MURF_VOICE_ID', default='Anisha')
MURF_VOICE_STYLE = config('MURF_VOICE_STYLE', default='Conversation')
MURF_VOICE_MODEL = config('MURF_VOICE_MODEL', default='FALCON')
# ─────────────────────────────────────────────
# INSTALLED APPS
# ─────────────────────────────────────────────
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'storages',
    'django_celery_beat',
    'django_celery_results',
    'drf_spectacular',
]
# settings.py
TIME_ZONE = 'Asia/Kolkata'
USE_TZ    = True
LOCAL_APPS = [
    'apps.authentication',
    'apps.users',
    'apps.business',
    'apps.branches',
    'apps.cashbook',
    'apps.documents',
    'apps.itr_analysis',
    'apps.ai_chatbot',
    'apps.dashboard',
    'apps.reports',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


# ─────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',              # Must be high up
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
]

import dj_database_url
import os
DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL')
    )
}
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATIC_URL = '/static/'
# ─────────────────────────────────────────────
# URL & WSGI
# ─────────────────────────────────────────────
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'


# ─────────────────────────────────────────────
# TEMPLATES
# ─────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# ─────────────────────────────────────────────
# DATABASE – PostgreSQL
# ─────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     config('DB_NAME',     default='aibms_db'),
        'USER':     config('DB_USER',     default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST':     config('DB_HOST',     default='localhost'),
        'PORT':     config('DB_PORT',     default='5432'),
    }
}


# ─────────────────────────────────────────────
# CUSTOM USER MODEL (will be created in users app)
# ─────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'


# ─────────────────────────────────────────────
# PASSWORD VALIDATION
# ─────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ─────────────────────────────────────────────
# DJANGO REST FRAMEWORK
# ─────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'utils.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
}


# ─────────────────────────────────────────────
# JWT SETTINGS
# ─────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(
        minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
    ),
    'ROTATE_REFRESH_TOKENS':      True,
    'BLACKLIST_AFTER_ROTATION':   True,
    'UPDATE_LAST_LOGIN':          True,
    'ALGORITHM':                  'HS256',
    'AUTH_HEADER_TYPES':          ('Bearer',),
    'AUTH_TOKEN_CLASSES':         ('rest_framework_simplejwt.tokens.AccessToken',),
}


# ─────────────────────────────────────────────
# CORS SETTINGS
# ─────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default= "http://localhost:5173,http://127.0.0.1:5173"
).split(',')

CORS_ALLOW_CREDENTIALS = True


# ─────────────────────────────────────────────
# CELERY SETTINGS
# ─────────────────────────────────────────────
CELERY_BROKER_URL          = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND      = 'django-db'
CELERY_CACHE_BACKEND       = 'django-cache'
CELERY_ACCEPT_CONTENT      = ['json']
CELERY_TASK_SERIALIZER     = 'json'
CELERY_RESULT_SERIALIZER   = 'json'
CELERY_TIMEZONE            = 'Asia/Kolkata'
CELERY_BEAT_SCHEDULER      = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# ─────────────────────────────────────────────
# AWS S3 STORAGE
# ─────────────────────────────────────────────
AWS_ACCESS_KEY_ID       = config('AWS_ACCESS_KEY_ID',       default='')
AWS_SECRET_ACCESS_KEY   = config('AWS_SECRET_ACCESS_KEY',   default='')
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='')
AWS_S3_REGION_NAME      = config('AWS_S3_REGION_NAME',      default='ap-south-1')
AWS_S3_FILE_OVERWRITE   = False
AWS_DEFAULT_ACL         = 'private'
AWS_S3_CUSTOM_DOMAIN    = None

# Use S3 only when AWS keys are provided
if AWS_ACCESS_KEY_ID and AWS_STORAGE_BUCKET_NAME:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
else:
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'


# ─────────────────────────────────────────────
# OPENAI
# ─────────────────────────────────────────────
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')


# ─────────────────────────────────────────────
# STATIC & MEDIA FILES
# ─────────────────────────────────────────────
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# ─────────────────────────────────────────────
# INTERNATIONALIZATION
# ─────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Asia/Kolkata'
USE_I18N      = True
USE_TZ        = True


# ─────────────────────────────────────────────
# DEFAULT PRIMARY KEY
# ─────────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs/aibms.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}


# ─────────────────────────────────────────────
# API DOCUMENTATION (drf-spectacular)
# ─────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE':       'AIBMS – AI API',
    'DESCRIPTION': 'AI-Based Business Management System API Documentation',
    'VERSION':     '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
