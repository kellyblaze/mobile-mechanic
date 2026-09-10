# Frontend handoff — Claude source of truth

Repository: E:\Projects\Mobile Mechanic
Branch: feature/issue-2-backend-completion
Backend handoff commit: 90e07833f043a7f7167672b0d64039d48cb04a51
Contract version: 1.9.0
Canonical contract: packages/contracts/openapi.yaml
Generated client: packages/contracts/generated/client.ts

## Ownership and non-overlap

Claude may modify only:

- apps/web/**
- frontend-only files under packages/ui/**
- frontend tests and frontend assets

Claude must not modify:

- apps/api/**, packages/database/**, packages/domain/**
- packages/contracts/openapi.yaml
- packages/contracts/generated/** or packages/contracts/fixtures/**
- packages/database/migrations/**
- root package.json, pnpm-lock.yaml, authentication, authorization, or backend business rules
- .env or any secret-bearing file

Do not invent endpoints, fields, roles, statuses, prices, policies, credentials, or successful provider integrations. If a UI need is not covered by the contract, create docs/change-requests/CR-###.md and leave the UI in an honest pending/error state. Codex owns contract and backend changes.

## Development

From the repository root:

    pnpm install
    pnpm dev
    pnpm --filter web dev

API base URL: http://127.0.0.1:3000/api/v1

Local development actors use explicit headers:

    X-Dev-User-Id: customer-demo
    X-Dev-Role: customer

Other safe actors are mechanic-demo/mechanic and admin-demo/admin. This is not real login and must remain visibly development-only. Use pnpm api:mock only for explicit fixture mode. Never put service-role, Stripe secret, or Supabase secret values in frontend code.

## Implemented operations

Use the generated client through one frontend adapter.

- Session/catalog: GET /session, GET /service-catalog
- Vehicles: GET/POST /vehicles, GET /vehicles/{id}/history
- Intake/uploads: POST /service-requests, POST /uploads, POST /uploads/{id}/complete; uploads require configured private Supabase Storage and return a short-lived signed upload URL
- Quotes: GET /quotes/{id}, POST /quotes/{id}/accept, POST /admin/service-requests/{id}/quotes
- Account provisioning: POST /admin/memberships (admin only; links an existing Supabase Auth user by email)
- Admin quote discovery: GET /admin/service-requests?status=submitted
- Repair Room: GET/POST /jobs/{id}/findings, GET/POST /jobs/{id}/messages, GET /jobs/{id}
- Jobs: GET /admin/jobs, GET /mechanic/jobs, POST /jobs/{id}/transitions, POST /jobs/{id}/completion-report
- Scheduling: GET /availability, POST /booking-holds, POST /booking-holds/{id}/confirm (returns appointment and scheduled job)
- Cancellation: POST /appointments/{id}/cancel; customers and mechanics require at least two hours notice, admins may cancel future appointments; refunds remain admin-controlled
- Mechanics: GET /mechanics
- Billing: GET /invoices, POST /admin/jobs/{id}/invoices, POST /payments (optional invoiceId), POST /payments/{id}/refund

Payment UI must use the returned Stripe client secret and clearly distinguish test/development mode. Implemented does not mean all business policy or provider deployment work is complete.

## Required frontend work

Build accessible customer, mechanic, and admin flows for intake, garage, Vehicle Passport, quote review, availability, booking, Repair Room, invoices, payment confirmation, mechanic jobs, findings, messages, completion reports, admin queues, quote issuance, and refunds.

Every screen must cover loading, empty, validation, unauthorized, conflict/stale-version, offline, and server-error states. Keep mock mode explicit and visibly labeled.

## Verification

Run:

    pnpm typecheck
    pnpm test
    pnpm --filter web build

The backend cleanup command is pnpm test:cleanup-users. It requires local service-role configuration and deletes only users whose email begins with codex-. Do not run it unless cleanup is intended.

## Contract changes

1. Create docs/change-requests/CR-###.md with the user need, exact schema/status change, compatibility impact, affected screens, and acceptance tests.
2. Do not edit OpenAPI, migrations, generated files, server rules, or backend files in the frontend task.
3. Tell Codex the request ID and blocked operation.
4. Wait for a new contract version and regenerated client/fixtures.

## Ready-to-paste Claude prompt

You are taking over the frontend only for the Mobile Mechanic repository.

Read AGENTS.md, CLAUDE.md, docs/product-build-agreement.md, docs/architecture.md, docs/integration-status.md, docs/production-hardening.md, docs/frontend-handoff.md, packages/contracts/openapi.yaml, packages/contracts/generated/client.ts, and packages/contracts/fixtures/index.json.

Work from branch feature/issue-2-backend-completion at the backend handoff commit named in this file. The API contract is version 1.8.0.

Modify only apps/web and frontend-only packages/ui files. Do not modify backend, database, migrations, OpenAPI, generated client, fixtures, root tooling, environment secrets, authentication, authorization, or backend business rules. Use the generated client through one adapter. Do not invent endpoints or policies.

Wire the implemented operations listed above and build the customer, mechanic, and admin screens. Include all required loading, empty, validation, unauthorized, conflict/stale, offline, and server-error states. Keep development/mock mode explicit and visibly labeled.

If an operation is missing or its schema is insufficient, create docs/change-requests/CR-###.md and leave an honest pending/error state. Do not patch the backend.

Run pnpm typecheck, pnpm test, and pnpm --filter web build. Report exact files changed, commands/results, unresolved contract requests, and the final commit SHA.
