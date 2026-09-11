# Release readiness assessment

Status: **blocked for production release**. The development and staging foundation is substantially complete, but provider and deployment controls still require final validation.

## Completed foundation

- Preserved Claude’s frontend design and added only targeted API integration.
- Added Supabase JWT validation behind `AUTH_MODE=managed`; production startup now fails closed unless managed authentication and PostgreSQL are configured.
- Added Stripe signed webhook verification, event deduplication, and payment-attempt reconciliation.
- Added transactional PostgreSQL booking-hold and payment-attempt repository primitives.
- Advanced the OpenAPI contract through `2.2.0`, including private signed photo downloads.
- Added generated-client operation methods, request bodies, injected headers, and idempotency headers.
- Added quote lookup, vehicle history, service-request submission, upload metadata, findings, and job messages.
- Wired intake submission and Repair Room findings/messages to the development API.

## Remaining release blockers

- Production Supabase JWT, Stripe, storage, monitoring, database backup, and deployment configuration must be supplied and validated in the target environment.
- Rate limiting is process-local; use a shared gateway or Redis before horizontal scaling.
- Webhook retry/reconciliation alerts and a persistent worker still require operational validation.
- Business policies and notification providers remain unconfigured.
- Browser file-picker coverage and full provider E2E tests remain limited to manual/test-mode verification.

## Required production configuration

Business timezone/area/hours, catalog/pricing/tax/deposit/cancellation policy, managed auth, PostgreSQL, private storage, payment account, notifications, warranty terms, partners, hosting, backups, monitoring, rate limiting, and rollback procedure.

## Deployment, backup, rollback

No deployment or external service purchase was performed. Before release, apply migrations through an approved runner, take and verify a database backup, run concurrency and vertical-slice tests, deploy with a rollback-capable release, and retain the previous application image plus a reviewed migration rollback plan. Never expose the development auth adapter in production.
