# GrazingTrack Security Review

Review date: 3 November 2026

## Scope and limits

Reviewed the Django API, React API client, request serializers, account and password-reset flows, dependency manifests, tracked/unignored filenames, and map label rendering. This is a source review with automated checks, not a penetration test. The hosted PostgreSQL database was not inspected: an attempted backend test run against its configured pooler failed because the session pool had reached its client limit. Backend tests were subsequently run with local SQLite.

## Findings and changes

- **Browser-readable authentication tokens:** The client previously stored access and refresh JWTs in `localStorage`, making token theft easier if a script injection occurred. Authentication now uses short-lived HttpOnly JWT cookies; the backend accepts cookie JWTs only, rotates refresh tokens, and clears cookies on sign-out and password reset. The client removes legacy localStorage token entries and keeps only a non-secret signed-in marker.
- **CSRF for cookie authentication:** State-changing API views now enforce Django CSRF checks. A CSRF bootstrap endpoint provides the token to the client, which sends it in `X-CSRFToken` with credentialed requests. Missing CSRF tokens are covered by tests.
- **Production configuration:** Production startup now requires a long random Django secret, explicit hosts and HTTPS CORS/CSRF origins, HTTPS frontend URL and redirects, TLS for PostgreSQL, and a non-console email backend. Auth cookies are Secure outside development, HttpOnly, SameSite-configurable, and restricted to `/api/`. Django's deployment check passes with disposable production-like settings.
- **Password security:** Django's PBKDF2-SHA256 hasher is explicitly preferred; Django password validators remain enforced for registration, reset, and password change. Reset links expire after one hour, are single-use after password change, and revoke outstanding refresh tokens.
- **Throttling and monitoring:** Login, registration, password-reset, refresh, and farm-data scopes are rate-limited. Repeated login failures and throttle events log warnings without logging passwords or email addresses. Development uses process-local cache; production uses Django's database cache for cross-worker throttling.
- **Admin exposure:** `/admin/` is disabled by default and no longer disclosed by the API root. It is only routed when `DJANGO_ADMIN_ENABLED=true`; deployment-edge access controls are still required if enabled.
- **Server-side data validation:** Farm-data request size is bounded, fields/events/groups have count and object-shape checks, and farm profile data must be an object or null. Django ORM queries are used; no raw SQL execution paths were found. There are no file-upload endpoints to restrict.
- **XSS review:** React renders user strings as text and the Leaflet map tooltip values are HTML-escaped. No `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, or equivalent untrusted HTML sinks were found in the frontend source reviewed.
- **Repository exposure:** The SQLite database is ignored and not tracked; environment files present in the repository are examples with placeholders. A tracked-source scan found no matches for common private-key, cloud-key, or credentialed database-URL patterns. This scan cannot prove that a secret was never committed in another branch or historical revision.

## Dependency audit

- `pip-audit`: no known vulnerabilities in installed Python packages.
- `npm audit --omit=dev`: no production dependency vulnerabilities.
- Full `npm audit`: 10 low/moderate advisories in development/build tooling, involving `deepmerge`, `glob`, and `minimatch` in the PWA/Workbox build chain. `npm audit fix` has no non-breaking remediation; npm proposes forcing a downgrade of `vite-plugin-pwa` to 1.1.0, which was not applied because it may break the PWA setup.
- The Workbox dependency graph includes `@trickfilm400/rollup-plugin-off-main-thread`, whose registry metadata points to a single-maintainer repository. No direct advisory was reported for that package. Verify that publisher/repository is trusted before release; it was inspected as metadata only and not executed separately.
- No unused direct dependencies were identified in the manifests during this review.

## Verification

- Backend: 13 Django API tests pass against local SQLite. Coverage includes cookie flags, absence of JWTs from JSON, CSRF rejection and acceptance, PBKDF2 hash storage, refresh rotation/revocation, reset expiry, login throttling, per-user farm-data access, malformed payload rejection, and disabled admin routing.
- Django local system check passes.
- Django `check --deploy` passes with disposable production-like settings.
- Frontend production build passes; all 5 frontend tests pass.
- Python dependency audit is clean; production npm audit is clean.

## Required before public deployment

1. Set a new random `DJANGO_SECRET_KEY`; do not reuse the development example. Keep database and SMTP credentials server-side only.
2. Set `DJANGO_DEBUG=false`, exact HTTPS `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and HTTPS `FRONTEND_URL`. For genuinely cross-site frontend/API hosting, set `DJANGO_COOKIE_SAMESITE=None` and use HTTPS for both.
3. Run migrations, then create the shared production throttle cache table once with `python backend/manage.py createcachetable`.
4. Configure production email delivery; do not use Django's console email backend outside development. Restrict SMTP credentials and confirm reset messages go only to the intended frontend origin.
5. Keep `DJANGO_ADMIN_ENABLED=false` unless needed. If enabled, add strong staff MFA and restrict `/admin/` at the proxy/WAF or network layer.
6. Review the hosted database's access role, network restrictions, backups/restore process, retention, and any direct Supabase exposure in its dashboard. Those controls could not be verified from this repository.
7. Review the remaining npm build-tool advisories and the Workbox package provenance before relying on the PWA build in a public release. Avoid `npm audit fix --force` without a compatibility review.
8. Configure centralized log retention/alerting for auth-failure and throttle warnings. Current application code emits warnings to the process logger; it does not provision an alerting service.
