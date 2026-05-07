# Branches models
# apps/branches/models.py
# AIBMS – BharatSync AI
# Branch Model

import uuid
from django.db import models
from apps.users.models import User
from apps.business.models import Business


class Branch(models.Model):

    class BranchType(models.TextChoices):
        HEAD_OFFICE  = 'head_office',  'Head Office'
        BRANCH       = 'branch',       'Branch'
        WAREHOUSE    = 'warehouse',    'Warehouse'
        OUTLET       = 'outlet',       'Outlet'
        FRANCHISE    = 'franchise',    'Franchise'

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='branches')
    name     = models.CharField(max_length=255)
    code     = models.CharField(max_length=20, blank=True, help_text='Short branch code e.g. NSK-001')
    branch_type = models.CharField(max_length=20, choices=BranchType.choices, default=BranchType.BRANCH)

    # ── Same-city disambiguation ───────────────────────────────────────────
    # When multiple branches share a city, this field stores the locality/area
    # (e.g. "Karvenagar", "Old Nashik", "MIDC") shown as a badge in the UI.
    locality = models.CharField(
        max_length=100, blank=True,
        help_text='Locality/area within the city — used to distinguish branches in the same city',
    )

    manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_branches', limit_choices_to={'role': 'branch_manager'},
    )
    email         = models.EmailField(blank=True)
    phone         = models.CharField(max_length=15, blank=True)
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city          = models.CharField(max_length=100, blank=True, db_index=True)
    state         = models.CharField(max_length=100, blank=True)
    pincode       = models.CharField(max_length=10, blank=True)
    country       = models.CharField(max_length=100, default='India')
    latitude      = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active     = models.BooleanField(default=True)
    is_primary    = models.BooleanField(default=False, help_text='Primary/main branch of the business')
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'branches'
        verbose_name    = 'Branch'
        verbose_name_plural = 'Branches'
        ordering        = ['-created_at']
        unique_together = ('business', 'code')
        indexes = [
            models.Index(fields=['business', 'city']),
            models.Index(fields=['business', 'is_active']),
        ]

    def __str__(self):
        if self.locality:
            return f"{self.name} ({self.locality}) – {self.business.name}"
        return f"{self.name} – {self.business.name}"

    @property
    def full_address(self):
        parts = filter(None, [
            self.address_line1, self.address_line2,
            self.locality, self.city, self.state, self.pincode, self.country,
        ])
        return ', '.join(parts)

    @property
    def display_name(self):
        """Returns name with locality appended if not already included."""
        if self.locality and self.locality.lower() not in self.name.lower():
            return f"{self.name} ({self.locality})"
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            prefix = self.locality[:3].upper() if self.locality else (self.city[:3].upper() if self.city else 'BRN')
            count  = Branch.objects.filter(business=self.business).count() + 1
            self.code = f"{prefix}-{count:03d}"
        super().save(*args, **kwargs)

    def get_same_city_branches(self):
        """Returns other active branches in the same city under the same business."""
        if not self.city:
            return Branch.objects.none()
        return Branch.objects.filter(
            business=self.business, city__iexact=self.city, is_active=True,
        ).exclude(pk=self.pk)


class BranchMember(models.Model):

    class MemberRole(models.TextChoices):
        MANAGER    = 'manager',    'Manager'
        ACCOUNTANT = 'accountant', 'Accountant'
        STAFF      = 'staff',      'Staff'
        CA         = 'ca',         'CA / Consultant'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch      = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='members')
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='branch_memberships')
    role        = models.CharField(max_length=15, choices=MemberRole.choices, default=MemberRole.STAFF)
    is_active   = models.BooleanField(default=True)
    joined_at   = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='branch_assignments',
    )

    class Meta:
        db_table        = 'branch_members'
        unique_together = ('branch', 'user')
        ordering        = ['-joined_at']

    def __str__(self):
        return f"{self.user.full_name} @ {self.branch.name} ({self.role})"


class BranchOperatingHours(models.Model):

    class Day(models.IntegerChoices):
        MONDAY    = 0, 'Monday'
        TUESDAY   = 1, 'Tuesday'
        WEDNESDAY = 2, 'Wednesday'
        THURSDAY  = 3, 'Thursday'
        FRIDAY    = 4, 'Friday'
        SATURDAY  = 5, 'Saturday'
        SUNDAY    = 6, 'Sunday'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch     = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='operating_hours')
    day        = models.IntegerField(choices=Day.choices)
    open_time  = models.TimeField(null=True, blank=True)
    close_time = models.TimeField(null=True, blank=True)
    is_closed  = models.BooleanField(default=False)

    class Meta:
        db_table        = 'branch_operating_hours'
        unique_together = ('branch', 'day')
        ordering        = ['day']

    def __str__(self):
        day_name = self.Day(self.day).label
        if self.is_closed:
            return f"{self.branch.name} – {day_name}: Closed"
        return f"{self.branch.name} – {day_name}: {self.open_time} to {self.close_time}"