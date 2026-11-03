import logging

from rest_framework.throttling import ScopedRateThrottle


logger = logging.getLogger('farmdata.security')


class SecurityScopedRateThrottle(ScopedRateThrottle):
    def allow_request(self, request, view):
        self.request = request
        return super().allow_request(request, view)

    def throttle_failure(self):
        logger.warning(
            'Rate limit exceeded: scope=%s remote_addr=%s',
            self.scope,
            self.get_ident(self.request),
        )
        return super().throttle_failure()