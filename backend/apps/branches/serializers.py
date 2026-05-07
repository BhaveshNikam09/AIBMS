# Branches serializers
# apps/branches/serializers.py
# AIBMS – BharatSync AI

from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from .models import Branch, BranchMember, BranchOperatingHours


class BranchOperatingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_display', read_only=True)

    class Meta:
        model  = BranchOperatingHours
        fields = ['id', 'day', 'day_name', 'open_time', 'close_time', 'is_closed']
        read_only_fields = ['id', 'day_name']

    def validate(self, attrs):
        if not attrs.get('is_closed'):
            if not attrs.get('open_time'):
                raise serializers.ValidationError({"open_time": "Open time is required when branch is not closed."})
            if not attrs.get('close_time'):
                raise serializers.ValidationError({"close_time": "Close time is required when branch is not closed."})
            if attrs.get('open_time') and attrs.get('close_time'):
                if attrs['open_time'] >= attrs['close_time']:
                    raise serializers.ValidationError({"close_time": "Close time must be after open time."})
        return attrs


class BranchCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Branch
        fields = [
            'name', 'code', 'branch_type', 'locality', 'manager',
            'email', 'phone', 'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'latitude', 'longitude', 'is_primary',
        ]
        extra_kwargs = {
            'code': {'required': False}, 'locality': {'required': False}, 'manager': {'required': False},
        }

    def validate_code(self, value):
        if value:
            business = self.context.get('business')
            qs = Branch.objects.filter(business=business, code=value.upper())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A branch with this code already exists in this business.")
        return value.upper() if value else value

    def validate_manager(self, value):
        if value and value.role != 'branch_manager':
            raise serializers.ValidationError("Assigned manager must have the 'Branch Manager' role.")
        return value

    def validate(self, attrs):
        business = self.context.get('business')
        if attrs.get('is_primary'):
            qs = Branch.objects.filter(business=business, is_primary=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"is_primary": "A primary branch already exists for this business."})

        city     = attrs.get('city', '').strip()
        locality = attrs.get('locality', '').strip()
        if city and not locality:
            existing = Branch.objects.filter(business=business, city__iexact=city, is_active=True)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.filter(name__iexact=attrs.get('name', '')).exists():
                raise serializers.ValidationError({
                    "name": f"A branch named '{attrs.get('name')}' already exists in {city}. Add a locality to distinguish it."
                })
        return attrs

    def create(self, validated_data):
        business = self.context['business']
        branch   = Branch.objects.create(business=business, **validated_data)
        if branch.manager:
            BranchMember.objects.get_or_create(
                branch=branch, user=branch.manager,
                defaults={'role': BranchMember.MemberRole.MANAGER, 'assigned_by': self.context['request'].user},
            )
        return branch


class BranchListSerializer(serializers.ModelSerializer):
    manager_name    = serializers.CharField(source='manager.full_name', read_only=True)
    business_name   = serializers.CharField(source='business.name', read_only=True)
    full_address    = serializers.ReadOnlyField()
    display_name    = serializers.ReadOnlyField()
    same_city_count = serializers.SerializerMethodField()

    class Meta:
        model  = Branch
        fields = [
            'id', 'name', 'display_name', 'code', 'branch_type', 'locality',
            'business_name', 'manager_name', 'city', 'state', 'full_address',
            'phone', 'email', 'is_active', 'is_primary', 'same_city_count', 'created_at',
        ]

    def get_same_city_count(self, obj):
        if not obj.city:
            return 0
        return Branch.objects.filter(
            business=obj.business, city__iexact=obj.city, is_active=True,
        ).exclude(pk=obj.pk).count()


class BranchDetailSerializer(serializers.ModelSerializer):
    manager            = UserProfileSerializer(read_only=True)
    business_name      = serializers.CharField(source='business.name', read_only=True)
    full_address       = serializers.ReadOnlyField()
    display_name       = serializers.ReadOnlyField()
    operating_hours    = BranchOperatingHoursSerializer(many=True, read_only=True)
    same_city_branches = serializers.SerializerMethodField()

    class Meta:
        model  = Branch
        fields = [
            'id', 'name', 'display_name', 'code', 'branch_type', 'locality',
            'business_name', 'manager', 'email', 'phone',
            'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country',
            'full_address', 'latitude', 'longitude', 'is_active', 'is_primary',
            'operating_hours', 'same_city_branches', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_same_city_branches(self, obj):
        return [
            {'id': str(b.pk), 'name': b.name, 'locality': b.locality, 'code': b.code}
            for b in obj.get_same_city_branches()
        ]


class BranchUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Branch
        fields = [
            'name', 'branch_type', 'locality', 'manager',
            'email', 'phone', 'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'latitude', 'longitude', 'is_active', 'is_primary',
        ]

    def validate_manager(self, value):
        if value and value.role != 'branch_manager':
            raise serializers.ValidationError("Assigned manager must have the 'Branch Manager' role.")
        return value

    def validate(self, attrs):
        if attrs.get('is_primary'):
            qs = Branch.objects.filter(
                business=self.instance.business, is_primary=True
            ).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"is_primary": "A primary branch already exists for this business."})
        return attrs


class BranchMemberSerializer(serializers.ModelSerializer):
    user        = UserProfileSerializer(read_only=True)
    assigned_by = serializers.CharField(source='assigned_by.full_name', read_only=True)

    class Meta:
        model  = BranchMember
        fields = ['id', 'user', 'role', 'is_active', 'joined_at', 'assigned_by']
        read_only_fields = fields


class AddBranchMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role  = serializers.ChoiceField(choices=BranchMember.MemberRole.choices)

    def validate_email(self, value):
        from apps.users.models import User
        try:
            user = User.objects.get(email__iexact=value.strip())
        except User.DoesNotExist:
            raise serializers.ValidationError("No user found with this email.")
        branch = self.context['branch']
        if BranchMember.objects.filter(branch=branch, user=user).exists():
            raise serializers.ValidationError("This user is already a member of this branch.")
        self.context['member_user'] = user
        return value.lower()

    def save(self):
        return BranchMember.objects.create(
            branch      = self.context['branch'],
            user        = self.context['member_user'],
            role        = self.validated_data['role'],
            assigned_by = self.context['request'].user,
        )


class BulkOperatingHoursSerializer(serializers.Serializer):
    hours = BranchOperatingHoursSerializer(many=True)

    def validate_hours(self, value):
        days = [item['day'] for item in value]
        if len(days) != len(set(days)):
            raise serializers.ValidationError("Duplicate days found. Each day must appear only once.")
        return value

    def save(self):
        branch = self.context['branch']
        for hour_data in self.validated_data['hours']:
            BranchOperatingHours.objects.update_or_create(
                branch=branch, day=hour_data['day'],
                defaults={'open_time': hour_data.get('open_time'), 'close_time': hour_data.get('close_time'), 'is_closed': hour_data.get('is_closed', False)},
            )
        return BranchOperatingHours.objects.filter(branch=branch)