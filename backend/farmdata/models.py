from django.conf import settings
from django.db import models


class FarmData(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    fields = models.JSONField(default=list)
    events = models.JSONField(default=list)
    groups = models.JSONField(default=list)
    farm = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Farm data for {self.user.email or self.user.username}'