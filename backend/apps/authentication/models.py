# Authentication models
# apps/authentication/models.py
# AIBMS – BharatSync AI
# Authentication — OTP Model

import uuid
from django.db import models
from apps.users.models import User


class OTPVerification(models.Model):

    class OTPType(models.TextChoices):
        EMAIL_VERIFY   = 'email_verify',   'Email Verification'
        FORGOT_PASSWORD = 'forgot_password', 'Forgot Password'
        CHANGE_EMAIL   = 'change_email',   'Change Email'

    class OTPStatus(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        VERIFIED = 'verified', 'Verified'
        EXPIRED  = 'expired',  'Expired'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        User,
        on_delete    = models.CASCADE,
        related_name = 'otp_verifications',
    )
    otp_type   = models.CharField(
        max_length = 20,
        choices    = OTPType.choices,
    )
    otp_code   = models.CharField(max_length=6)
    status     = models.CharField(
        max_length = 10,
        choices    = OTPStatus.choices,
        default    = OTPStatus.PENDING,
    )
    attempts   = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table            = 'otp_verifications'
        ordering            = ['-created_at']
        verbose_name        = 'OTP Verification'
        verbose_name_plural = 'OTP Verifications'

    def __str__(self):
        return f"{self.user.email} — {self.otp_type} — {self.status}"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return (
            self.status  == self.OTPStatus.PENDING and
            not self.is_expired and
            self.attempts < 5
        )