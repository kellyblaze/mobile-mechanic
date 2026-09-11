# Architecture

Contract version: `2.0.0`. This is a TypeScript modular monolith: Fastify API, domain package, PostgreSQL migration package, and a future worker. React belongs in `apps/web` and is owned by Claude.

## Ownership

Codex owns `apps/api`, `packages/domain`, `packages/database`, `packages/contracts`, `packages/config`, migrations, root tooling, and `docs`. Claude owns `apps/web` and future `packages/ui`. Claude must not edit migrations, server rules, auth, authorization, OpenAPI, or generated client files.

## Security model

Managed authentication uses Supabase JWTs verified against the configured issuer, audience, and JWKS endpoint. The API synchronizes the JWT subject to `public.users` and resolves the role through `memberships`; local development headers remain available only with `AUTH_MODE=development`. Every implemented resource route checks role plus ownership/assignment. Stripe webhooks are signature-verified and intentionally exempt from bearer authentication.

## Data and concurrency

PostgreSQL is the durable system of record. Timestamps are `timestamptz`, money is integer minor units plus ISO currency, and accepted quote records are immutable by version. Migrations add private upload references, booking holds, appointment overlap exclusion, payment attempts, webhook deduplication, completion reports, and Supabase Auth synchronization. Vehicle, service-request, booking, Repair Room, quote, job, invoice, and payment writes use PostgreSQL repositories when configured; fixture fallback remains explicit for unfinished/mock paths.

## Authentication and providers

Authentication provider: Supabase Auth. `AUTH_MODE=managed` is the intended integration mode and fails closed on missing/invalid JWTs or missing memberships. `AUTH_MODE=development` uses explicitly unsafe local actor headers and is only for local fixture/development testing. Stripe test mode is used for payment intents, refunds, signed webhook delivery, deduplication, and reconciliation.

## Implemented at checkpoint

Health, managed/development session introspection, catalog read, customer vehicle list/create, authorized Repair Room access, quote acceptance/issuance, job transitions/completion, findings/messages, booking holds and confirmation, appointment cancellation and rescheduling, private signed uploads, invoices, payment intents/refunds, signed Stripe webhooks, admin monitoring proxy routes, admin jobs, and mechanic jobs are implemented to the current contract. Remaining work is production hardening, richer policy coverage, and frontend integration where noted in the integration status.

## Database architecture summary

Tables cover identity, memberships, vehicles, requests, quotes/lines, appointments, jobs, approvals, audit, and idempotency. Indexes cover customer/mechanic ownership and active appointment lookup. PostgreSQL 18 UUIDv7 and `timestamptz` are used. Production migration application, RLS policy SQL, exclusion constraints, and query-plan verification remain before launch.

## Rollback

This checkpoint is local and reversible through Git. Database migrations are additive foundation tables; production rollback requires the eventual migration runner and an approved rollback plan before deployment.
