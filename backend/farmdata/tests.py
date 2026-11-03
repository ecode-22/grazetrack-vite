from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase


class FarmDataApiTests(APITestCase):
    password = 'Healthy-Trail-93!'

    def setUp(self):
        cache.clear()

    def test_root_reports_api_status(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def create_account(self):
        response = self.client.post('/api/auth/register/', {
            'full_name': 'Test Farmer',
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
            'confirm_password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
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

    def test_register_and_login(self):
        registration = self.create_account()
        self.client.credentials()
        response = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)

    def test_refresh_rotates_and_blacklists_the_previous_token(self):
        registration = self.create_account()
        old_refresh = registration.data['refresh']
        response = self.client.post('/api/auth/refresh/', {'refresh': old_refresh}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('refresh', response.data)
        self.assertNotEqual(response.data['refresh'], old_refresh)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': old_refresh}, format='json').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': response.data['refresh']}, format='json').status_code, 200)

    def test_account_profile_password_change_and_logout(self):
        registration = self.create_account()
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], registration.data['user']['email'])

        self.client.credentials()
        second_session = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': self.password,
        }, format='json')
        self.assertEqual(second_session.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {second_session.data['access']}")
        response = self.client.post('/api/auth/password/', {
            'current_password': self.password,
            'new_password': 'New-Healthy-Trail-48!',
            'refresh': second_session.data['refresh'],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        self.client.credentials()
        revoked_refresh = self.client.post('/api/auth/refresh/', {
            'refresh': registration.data['refresh'],
        }, format='json')
        self.assertEqual(revoked_refresh.status_code, 401)
        response = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': 'New-Healthy-Trail-48!',
        }, format='json')
        self.assertEqual(response.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        logout_refresh = response.data['refresh']
        response = self.client.post('/api/auth/logout/', {'refresh': logout_refresh}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials()
        revoked_refresh = self.client.post('/api/auth/refresh/', {
            'refresh': logout_refresh,
        }, format='json')
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

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {first_account.data['access']}")
        response = self.client.post('/api/auth/logout/', {
            'refresh': second_account.data['refresh'],
        }, format='json')
        self.assertEqual(response.status_code, 400)

        self.client.credentials()
        response = self.client.post('/api/auth/refresh/', {
            'refresh': second_account.data['refresh'],
        }, format='json')
        self.assertEqual(response.status_code, 200)

    def test_farm_data_is_private_to_authenticated_user(self):
        self.client.credentials()
        self.assertEqual(self.client.get('/api/farm-data/').status_code, 401)

        self.create_account()
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