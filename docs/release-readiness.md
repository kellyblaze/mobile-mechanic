# Release readiness assessment

Status: **blocked for release review**. This branch completes available development integration but is not production-ready.

## Completed in this pass

- Preserved Claude’s frontend design and added only targeted API integration.
- Added Supabase JWT validation behind `AUTH_MODE=managed`; development headers remain only for explicit development mode.
- Added Stripe signed webhook verification, event deduplication, and payment-attempt reconciliation.
- Added transactional PostgreSQL booking-hold and payment-attempt repository primitives.
- Advanced the OpenAPI contract to `1.1.0`.
- Added generated-client operation methods, request bodies, injected headers, and idempotency headers.
- Added quote lookup, vehicle history, service-request submission, upload metadata, findings, and job messages.
- Wired intake submission and Repair Room findings/messages to the development API.

## Release blockers

- Development headers are still used; managed authentication and production session handling are absent.
- Vehicle and service-request repositories now use PostgreSQL when configured, but most API resources remain in-memory; RLS, durable idempotency enforcement, and production booking/payment services are pending.
- Managed authentication is not enabled: `AUTH_MODE=managed` fails closed until an approved OIDC/JWT provider configuration is supplied.
- Stripe webhook verification remains unverified because `STRIPE_WEBHOOK_SECRET` is still a placeholder.
- Full booking/payment route wiring and concurrent PostgreSQL integration tests remain pending.
- Availability, booking holds, appointments, transitions, change orders, invoices, payment webhooks/reconciliation, admin/mechanic operations, and notification workers are not production-complete.
- Uploads use a safe local metadata adapter; private object storage and signed retrieval are pending.
- No automated browser/E2E or provider test-mode suite exists.

## Required production configuration

Business timezone/area/hours, catalog/pricing/tax/deposit/cancellation policy, managed auth, PostgreSQL, private storage, payment account, notifications, warranty terms, partners, hosting, backups, monitoring, and rollback procedure.

## Deployment, backup, rollback

No deployment or external service purchase was performed. Before release, apply migrations through an approved runner, take and verify a database backup, run concurrency and vertical-slice tests, deploy with a rollback-capable release, and retain the previous application image plus a reviewed migration rollback plan. Never expose the development auth adapter in production.
