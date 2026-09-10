# Production hardening

## Implemented

- Supabase JWT verification fails closed in `AUTH_MODE=managed`.
- PostgreSQL row-level security migration `008_rls_policies.sql` protects direct client access; the API still enforces resource ownership and role authorization.
- API requests are rate-limited in memory by source IP. Configure `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`; use a shared Redis or gateway limiter before horizontal scaling.
- Stripe webhook events are stored as pending before processing and marked `processed_at` only after reconciliation. A failed delivery remains retryable and returns a non-2xx response.
- Stripe signatures are verified and webhook routes are exempt only from Supabase bearer authentication.

## Required deployment configuration

Set `DATABASE_URL`, `AUTH_MODE=managed`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, `SUPABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_ORIGIN`, `RATE_LIMIT_WINDOW_MS`, and `RATE_LIMIT_MAX`. Never expose service-role or Stripe secret keys to the frontend.

Expose `/health` to the platform health check. Forward logs to the platform collector and alert on repeated 5xx responses, 401/403 spikes, rate-limit spikes, webhook failures, and database connection failures. The current process does not ship a metrics backend; add OpenTelemetry or the hosting provider's metrics adapter before production traffic.

## Operational checks

Run `pnpm db:migrate`, `pnpm db:seed` only in development, `pnpm typecheck`, `pnpm test`, `pnpm test:managed-matrix`, and `pnpm test:stripe-reconciliation` in a test environment. Use `pnpm test:cleanup-users` afterward to remove disposable Supabase users created by the verification scripts.
