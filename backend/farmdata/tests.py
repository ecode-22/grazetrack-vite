from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import Client, override_settings
from datetime import datetime, timedelta
from unittest.mock import patch
from rest_framework.test import APITestCase


class FarmDataApiTests(APITestCase):
    password = 'Healthy-Trail-93!'

    def setUp(self):
        cache.clear()

    def test_root_reports_api_status(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')
        self.assertNotIn('admin', response.json())
        self.assertEqual(self.client.get('/admin/').status_code, 404)

    def create_account(self):
        response = self.client.post('/api/auth/register/', {
            'full_name': 'Test Farmer',
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
            'confirm_password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_registration_requires_matching_password_confirmation(self):
        email = f'{uuid4().hex}@example.com'
        response = self.client.post('/api/auth/register/', {
            'full_name': 'Test Farmer',
            'email': email,
            'password': self.password,
            'confirm_password': 'Different-Trail-85!',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('confirm_password', response.data)
        self.assertFalse(get_user_model().objects.filter(email=email).exists())

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_registration_sends_welcome_email(self):
        response = self.create_account()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [response.data['user']['email']])
        self.assertIn('Welcome to GrazingTrack', mail.outbox[0].subject)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_sends_expiring_link_and_changes_password_once(self):
        registration = self.create_account()
        account_email = registration.data['user']['email']
        self.client.credentials()
        response = self.client.post('/api/auth/password-reset/', {'email': account_email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('If an account exists', response.data['detail'])
        reset_url = next(part for part in mail.outbox[-1].body.split() if 'reset-password?' in part)
        query = parse_qs(urlsplit(reset_url).query)

        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': query['uid'][0],
            'token': query['token'][0],
            'password': 'New-Safe-River-82!',
            'confirm_password': 'New-Safe-River-82!',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': query['uid'][0],
            'token': query['token'][0],
            'password': 'Another-Safe-River-84!',
            'confirm_password': 'Another-Safe-River-84!',
        }, format='json')
        self.assertEqual(response.status_code, 400)

        response = self.client.post('/api/auth/login/', {
            'email': account_email,
            'password': 'New-Safe-River-82!',
        }, format='json')
        self.assertEqual(response.status_code, 200)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_does_not_disclose_unknown_email(self):
        response = self.client.post('/api/auth/password-reset/', {
            'email': f'{uuid4().hex}@example.com',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('If an account exists', response.data['detail'])
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_link_expires_after_configured_timeout(self):
        account = self.create_account().data['user']
        user = get_user_model().objects.get(pk=account['id'])
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        with override_settings(PASSWORD_RESET_TIMEOUT=60):
            with patch.object(default_token_generator, '_now', return_value=datetime.now() + timedelta(seconds=61)):
                response = self.client.post('/api/auth/password-reset/confirm/', {
                    'uid': uid,
                    'token': token,
                    'password': 'Expired-Safe-River-39!',
                    'confirm_password': 'Expired-Safe-River-39!',
                }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_rate_limit_blocks_repeated_attempts(self):
        for _attempt in range(5):
            response = self.client.post('/api/auth/login/', {
                'email': 'nobody@example.com',
                'password': 'Incorrect-Safe-River-41!',
            }, format='json')
            self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/auth/login/', {
            'email': 'nobody@example.com',
            'password': 'Incorrect-Safe-River-41!',
        }, format='json')
        self.assertEqual(response.status_code, 429)

    def test_register_and_login(self):
        registration = self.create_account()
        self.assertIn('gt_access', registration.cookies)
        self.assertIn('gt_refresh', registration.cookies)
        self.assertNotIn('access', registration.data)
        self.assertNotIn('refresh', registration.data)
        stored_user = get_user_model().objects.get(email=registration.data['user']['email'])
        self.assertTrue(stored_user.password.startswith('pbkdf2_sha256$'))
        self.client.credentials()
        response = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('gt_access', response.cookies)
        self.assertNotIn('access', response.data)

    def test_refresh_rotates_and_blacklists_the_previous_token(self):
        registration = self.create_account()
        old_refresh = registration.cookies['gt_refresh'].value
        response = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        new_refresh = response.cookies['gt_refresh'].value
        self.assertNotEqual(new_refresh, old_refresh)
        self.client.cookies['gt_refresh'] = old_refresh
        self.assertEqual(self.client.post('/api/auth/refresh/', {}, format='json').status_code, 401)
        self.client.cookies['gt_refresh'] = new_refresh
        self.assertEqual(self.client.post('/api/auth/refresh/', {}, format='json').status_code, 200)

    def test_account_profile_password_change_and_logout(self):
        registration = self.create_account()
        original_refresh = registration.cookies['gt_refresh'].value
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], registration.data['user']['email'])

        self.client.credentials()
        second_session = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': self.password,
        }, format='json')
        self.assertEqual(second_session.status_code, 200)
        current_refresh = second_session.cookies['gt_refresh'].value
        response = self.client.post('/api/auth/password/', {
            'current_password': self.password,
            'new_password': 'New-Healthy-Trail-48!',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        self.client.credentials()
        self.client.cookies['gt_refresh'] = original_refresh
        revoked_refresh = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(revoked_refresh.status_code, 401)
        response = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': 'New-Healthy-Trail-48!',
        }, format='json')
        self.assertEqual(response.status_code, 200)

        logout_refresh = response.cookies['gt_refresh'].value
        response = self.client.post('/api/auth/logout/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('gt_access', response.cookies)
        self.assertEqual(response.cookies['gt_access'].value, '')
        self.client.credentials()
        self.client.cookies['gt_refresh'] = logout_refresh
        revoked_refresh = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(revoked_refresh.status_code, 401)

    def test_account_cannot_revoke_another_users_refresh_token(self):
        first_account = self.create_account()
        second_account = self.client.post('/api/auth/register/', {
            'full_name': 'Second Farmer',
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
            'confirm_password': self.password,
        }, format='json')
        self.assertEqual(second_account.status_code, 201)

        self.client.cookies['gt_access'] = first_account.cookies['gt_access'].value
        self.client.cookies['gt_refresh'] = second_account.cookies['gt_refresh'].value
        response = self.client.post('/api/auth/logout/', {
            'refresh': second_account.cookies['gt_refresh'].value,
        }, format='json')
        self.assertEqual(response.status_code, 400)

        self.client.credentials()
        response = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_farm_data_is_private_to_authenticated_user(self):
        self.client.credentials()
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/farm-data/').status_code, 401)

        self.create_account()
        invalid_response = self.client.put('/api/farm-data/', {
            'fields': 'not-a-list',
            'events': [],
            'groups': [],
            'farm': None,
            'expected_updated_at': None,
        }, format='json')
        self.assertEqual(invalid_response.status_code, 400)

        empty_response = self.client.get('/api/farm-data/')
        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(empty_response.data['fields'], [])

        response = self.client.put('/api/farm-data/', {
            'fields': [{'id': 'field-1'}],
            'events': [],
            'groups': [],
            'farm': None,
            'expected_updated_at': None,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['fields'], [{'id': 'field-1'}])

        stale_response = self.client.put('/api/farm-data/', {
            'fields': [{'id': 'stale-field'}],
            'events': [],
            'groups': [],
            'farm': None,
            'expected_updated_at': None,
        }, format='json')
        self.assertEqual(stale_response.status_code, 409)
        self.assertEqual(stale_response.data['fields'], [{'id': 'field-1'}])

        self.create_account()
        response = self.client.get('/api/farm-data/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['fields'], [])
        self.assertEqual(response.data['events'], [])

    def test_authentication_requires_csrf_and_sets_httponly_cookies(self):
        client = Client(enforce_csrf_checks=True)
        csrf_response = client.get('/api/auth/csrf/')
        csrf_token = csrf_response.json()['csrfToken']
        payload = {
            'full_name': 'CSRF Test Farmer',
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
            'confirm_password': self.password,
        }
        rejected = client.post('/api/auth/register/', payload, content_type='application/json')
        self.assertEqual(rejected.status_code, 403)

        response = client.post(
            '/api/auth/register/',
            payload,
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.cookies['gt_access']['httponly'])
        self.assertTrue(response.cookies['gt_refresh']['httponly'])
        self.assertNotIn('access', response.json())
        self.assertNotIn('refresh', response.json())

        client.cookies.update(response.cookies)
        no_csrf = client.put(
            '/api/farm-data/',
            {'fields': [], 'events': [], 'groups': [], 'farm': None, 'expected_updated_at': None},
            content_type='application/json',
        )
        self.assertEqual(no_csrf.status_code, 403)
        with_csrf = client.put(
            '/api/farm-data/',
            {'fields': [], 'events': [], 'groups': [], 'farm': None, 'expected_updated_at': None},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(with_csrf.status_code, 200, with_csrf.content)