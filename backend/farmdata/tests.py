from uuid import uuid4

from rest_framework.test import APITestCase


class FarmDataApiTests(APITestCase):
    password = 'Healthy-Trail-93!'

    def test_root_reports_api_status(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def create_account(self):
        response = self.client.post('/api/auth/register/', {
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def test_register_and_login(self):
        registration = self.create_account()
        self.client.credentials()
        response = self.client.post('/api/auth/login/', {
            'email': registration.data['user']['email'],
            'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)

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
            'email': f'{uuid4().hex}@example.com',
            'password': self.password,
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
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['fields'], [{'id': 'field-1'}])

        self.create_account()
        response = self.client.get('/api/farm-data/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['fields'], [])
        self.assertEqual(response.data['events'], [])