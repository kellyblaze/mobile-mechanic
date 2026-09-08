# Architecture

Contract version: `1.0.0`. This is a TypeScript modular monolith: Fastify API, domain package, PostgreSQL migration package, and a future worker. React belongs in `apps/web` and is intentionally only a placeholder at this checkpoint.

## Ownership

Codex owns `apps/api`, `packages/domain`, `packages/database`, `packages/contracts`, `packages/config`, migrations, root tooling, and `docs`. Claude owns `apps/web` and future `packages/ui`. Claude must not edit migrations, server rules, auth, authorization, OpenAPI, or generated client files.

## Security model

Production authentication is designed for managed provider sessions in secure, HttpOnly, SameSite cookies. This checkpoint exposes an explicit development adapter using `X-Dev-User-Id` and `X-Dev-Role`; it is not production authentication and should never be enabled in production. Every implemented resource route checks role plus ownership/assignment. The schema uses memberships rather than a single role per person. API errors do not expose stack traces.

## Data and concurrency

PostgreSQL 18 is the target. New identifiers use native `uuidv7()`, timestamps are `timestamptz`, money is integer minor units plus ISO currency, and accepted quote records are immutable by version. Booking and hold constraints will use a transaction plus exclusion constraint in the next backend phase; the current API does not pretend booking is implemented. Idempotency records are provisioned in the schema and acceptance requires an idempotency key, while the in-memory adapter is not durable.

## Implemented at checkpoint

Health, development session introspection, catalog read, customer vehicle list/create, authorized Repair Room job read, and quote acceptance with validation, ownership, role checks, version conflict, and explicit mock-mode metadata for catalog. The rest of the first-release surface is contract-planned but pending.

## Database architecture summary

Tables cover identity, memberships, vehicles, requests, quotes/lines, appointments, jobs, approvals, audit, and idempotency. Indexes cover customer/mechanic ownership and active appointment lookup. PostgreSQL 18 UUIDv7 and `timestamptz` are used. Production migration application, RLS policy SQL, exclusion constraints, and query-plan verification remain before launch.

## Rollback

This checkpoint is local and reversible through Git. Database migrations are additive foundation tables; production rollback requires the eventual migration runner and an approved rollback plan before deployment.
