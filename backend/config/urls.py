from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path


def api_root(request):
    return JsonResponse({
        'service': 'GrazingTrack API',
        'status': 'ok',
        'api': '/api/',
    })


urlpatterns = [
    path('api/', include('farmdata.urls')),
    path('', api_root, name='api_root'),
]

if settings.ENABLE_DJANGO_ADMIN:
    from django.contrib import admin

    urlpatterns.insert(0, path('admin/', admin.site.urls))