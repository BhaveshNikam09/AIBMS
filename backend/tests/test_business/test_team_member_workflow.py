import os
import sys
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import django
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

django.setup()

from apps.branches.models import Branch, BranchMember
from apps.business.models import BusinessMember
from apps.users.models import User, UserRole


@override_settings(ALLOWED_HOSTS=['localhost', 'testserver'])
class TeamMemberWorkflowTests(APITestCase):
    def setUp(self):
        self.owner_password = 'OwnerPass123!'
        self.owner = User.objects.create_user(
            email='owner.workflow@example.com',
            password=self.owner_password,
            full_name='Workflow Owner',
            role=UserRole.BUSINESS_OWNER,
            is_verified=True,
        )

    def login(self, email, password):
        client = APIClient(HTTP_HOST='localhost')
        response = client.post(
            '/api/v1/auth/login/',
            {'email': email, 'password': password},
            format='json',
        )
        return client, response

    def create_business(self):
        owner_client, login_response = self.login(
            self.owner.email,
            self.owner_password,
        )
        self.assertEqual(login_response.status_code, 200)

        access_token = login_response.json()['data']['tokens']['access']
        owner_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        business_response = owner_client.post(
            '/api/v1/business/',
            {'name': 'Workflow Business', 'category': 'service'},
            format='json',
        )
        self.assertEqual(business_response.status_code, 201)

        business_id = business_response.json()['data']['id']
        return owner_client, business_id

    def create_branch(self, owner_client, business_id):
        response = owner_client.post(
            f'/api/v1/branches/{business_id}/',
            {'name': 'Main Branch'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        return response.json()['data']['id']

    def test_owner_can_create_manager_alias_and_manager_can_log_in(self):
        owner_client, business_id = self.create_business()
        branch_id = self.create_branch(owner_client, business_id)

        response = owner_client.post(
            f'/api/v1/business/{business_id}/members/create/',
            {
                'full_name': 'Workflow Manager',
                'email': 'manager.workflow@example.com',
                'password': 'ManagerPass123!',
                'role': 'manager',
                'branch_id': branch_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data']['role'], 'branch_manager')

        manager = User.objects.get(email='manager.workflow@example.com')
        membership = BusinessMember.objects.get(
            business_id=business_id,
            user=manager,
        )
        branch = Branch.objects.get(id=branch_id)
        branch_member = BranchMember.objects.get(branch=branch, user=manager)

        self.assertEqual(
            membership.role,
            BusinessMember.MemberRole.BRANCH_MANAGER,
        )
        self.assertEqual(branch.manager, manager)
        self.assertEqual(branch_member.role, BranchMember.MemberRole.MANAGER)
        self.assertTrue(branch_member.is_active)

        manager_client, login_response = self.login(
            manager.email,
            'ManagerPass123!',
        )
        self.assertEqual(login_response.status_code, 200)

        access_token = login_response.json()['data']['tokens']['access']
        manager_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        businesses_response = manager_client.get('/api/v1/business/my/')

        self.assertEqual(businesses_response.status_code, 200)
        self.assertEqual(len(businesses_response.json()['data']), 1)

    def test_owner_can_create_accountant_and_accountant_can_log_in(self):
        owner_client, business_id = self.create_business()
        branch_id = self.create_branch(owner_client, business_id)

        response = owner_client.post(
            f'/api/v1/business/{business_id}/members/create/',
            {
                'full_name': 'Workflow Accountant',
                'email': 'accountant.workflow@example.com',
                'password': 'AccountPass123!',
                'role': 'accountant',
                'branch_id': branch_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data']['role'], 'accountant')

        accountant = User.objects.get(email='accountant.workflow@example.com')
        membership = BusinessMember.objects.get(
            business_id=business_id,
            user=accountant,
        )
        branch = Branch.objects.get(id=branch_id)
        branch_member = BranchMember.objects.get(branch=branch, user=accountant)

        self.assertEqual(
            membership.role,
            BusinessMember.MemberRole.ACCOUNTANT,
        )
        self.assertEqual(branch_member.role, BranchMember.MemberRole.ACCOUNTANT)
        self.assertTrue(branch_member.is_active)

        accountant_client, login_response = self.login(
            accountant.email,
            'AccountPass123!',
        )
        self.assertEqual(login_response.status_code, 200)

        access_token = login_response.json()['data']['tokens']['access']
        accountant_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        businesses_response = accountant_client.get('/api/v1/business/my/')

        self.assertEqual(businesses_response.status_code, 200)
        self.assertEqual(len(businesses_response.json()['data']), 1)
