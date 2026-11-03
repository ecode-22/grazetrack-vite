import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or (
    'django-insecure-local-development-key' if DEBUG else ''
)
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.')
ALLOWED_HOSTS = [host.strip() for host in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'farmdata',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'


def database_config():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}

    parsed = urlparse(database_url)
    query = parse_qs(parsed.query)
    options = {}
    if query.get('sslmode'):
        options['sslmode'] = query['sslmode'][0]
    return {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote(parsed.path.lstrip('/')),
        'USER': unquote(parsed.username or ''),
        'PASSWORD': unquote(parsed.password or ''),
        'HOST': parsed.hostname,
        'PORT': parsed.port or 5432,
        'OPTIONS': options,
        'CONN_MAX_AGE': 60,
    }}


DATABASES = database_config()
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'farmdata.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'farmdata.throttling.SecurityScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'auth_login': '5/minute',
        'auth_register': '3/hour',
        'auth_reset': '3/hour',
        'auth_refresh': '10/minute',
        'farm_data': '60/minute',
    },
}
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=10),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}
PASSWORD_RESET_TIMEOUT = 60 * 60
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]
JWT_ACCESS_COOKIE = 'gt_access'
JWT_REFRESH_COOKIE = 'gt_refresh'
JWT_COOKIE_SECURE = not DEBUG
JWT_COOKIE_SAMESITE = os.environ.get('DJANGO_COOKIE_SAMESITE', 'Lax')
JWT_COOKIE_PATH = '/api/'
if JWT_COOKIE_SAMESITE.lower() not in {'lax', 'strict', 'none'}:
    raise RuntimeError('DJANGO_COOKIE_SAMESITE must be Lax, Strict, or None.')
if JWT_COOKIE_SAMESITE.lower() == 'none' and not JWT_COOKIE_SECURE:
    raise RuntimeError('SameSite=None auth cookies require HTTPS and secure cookies.')
STATIC_ROOT = BASE_DIR / 'staticfiles'
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', 'false' if DEBUG else 'true').lower() == 'true'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = JWT_COOKIE_SAMESITE
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS = 'DENY'
if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get(
    'CORS_ALLOWED_ORIGINS', '' if not DEBUG else 'http://localhost:5173,http://localhost:5174,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:4173'
).split(',') if origin.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [r'^https?://(localhost|127\.0\.0\.1):\d+$'] if DEBUG else []
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get(
    'CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS) if DEBUG else ''
).split(',') if origin.strip()]
ENABLE_DJANGO_ADMIN = os.environ.get('DJANGO_ADMIN_ENABLED', 'false').lower() == 'true'
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() == 'true'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'GrazingTrack <no-reply@grazingtrack.local>')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache' if DEBUG else 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'grazetrack-throttles' if DEBUG else 'grazetrack_cache',
    },
}
DATA_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000

if not DEBUG:
    if not os.environ.get('DATABASE_URL'):
        raise RuntimeError('DATABASE_URL must be configured outside development.')
    if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith('django-insecure-'):
        raise RuntimeError('DJANGO_SECRET_KEY must be a unique random value of at least 50 characters.')
    if not os.environ.get('DJANGO_ALLOWED_HOSTS'):
        raise RuntimeError('DJANGO_ALLOWED_HOSTS must be explicitly configured outside development.')
    if not FRONTEND_URL.startswith('https://'):
        raise RuntimeError('FRONTEND_URL must use HTTPS outside development.')
    if EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
        raise RuntimeError('Configure a production email backend; console email can expose password-reset links in logs.')
    if not CORS_ALLOWED_ORIGINS or any(not origin.startswith('https://') for origin in CORS_ALLOWED_ORIGINS):
        raise RuntimeError('CORS_ALLOWED_ORIGINS must contain only explicit HTTPS origins outside development.')
    if not CSRF_TRUSTED_ORIGINS or any(not origin.startswith('https://') for origin in CSRF_TRUSTED_ORIGINS):
        raise RuntimeError('CSRF_TRUSTED_ORIGINS must contain only explicit HTTPS origins outside development.')
    if not SECURE_SSL_REDIRECT:
        raise RuntimeError('DJANGO_SECURE_SSL_REDIRECT must remain enabled outside development.')
    database_query = parse_qs(urlparse(os.environ['DATABASE_URL']).query)
    if database_query.get('sslmode', [''])[0] not in {'require', 'verify-ca', 'verify-full'}:
        raise RuntimeError('DATABASE_URL must require TLS with sslmode=require or stronger outside development.')

if os.environ.get('DJANGO_TRUST_X_FORWARDED_PROTO', 'false').lower() == 'true':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {
        'farmdata.security': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}