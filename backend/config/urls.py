from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def api_root(request):
    return JsonResponse({
        'service': 'GrazingTrack API',
        'status': 'ok',
        'api': '/api/',
        'admin': '/admin/',
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('farmdata.urls')),
    path('', api_root, name='api_root'),
]