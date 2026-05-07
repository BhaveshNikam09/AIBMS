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
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
    path('api/v1/reports/',   include('apps.reports.urls')),
]
