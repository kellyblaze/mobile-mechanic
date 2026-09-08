# Frontend handoff

Repository: `E:\Projects\Mobile Mechanic`  
Branch: see `git branch --show-current`  
Commit SHA: populated after the checkpoint commit  
Contract: `1.0.0`, `packages/contracts/openapi.yaml`

## Claude ownership

Claude may modify `apps/web` and add frontend-only files under `packages/ui`. Claude must not modify `apps/api`, `packages/domain`, `packages/database`, `packages/contracts/openapi.yaml`, generated client files, migrations, root package manager configuration, or auth/authorization rules.

## Run modes

Run `pnpm install`, then `pnpm dev`. The API is at `http://127.0.0.1:3000`. Use `pnpm api:mock` for explicitly enabled fixture mode. The dev session headers are `X-Dev-User-Id: customer-demo` and `X-Dev-Role: customer`; safe staff values are `mechanic-demo`/`mechanic` and `admin-demo`/`admin`. No real credentials or messages are used.

## Required screens and operations

Homepage/intake/catalog: `GET /service-catalog`; vehicle flow: `GET/POST /vehicles`; quote review/approval: `GET/POST /quotes/{id}/accept`; Repair Room: `GET /jobs/{id}`. Availability, booking, messages, findings, change orders, completion, invoices, payments, admin queues, and Vehicle Passport are required product screens but their backend operations remain pending and must use clearly labeled fixtures until published.

Every screen must implement loading, empty, validation, unauthorized, conflict/stale, offline, and server-error states. Use the generated client through one adapter; do not hard-code business rules or API field names.

## Contract changes

Create `docs/change-requests/CR-###.md` with user need, proposed contract, compatibility, screens, and acceptance checks. Codex updates OpenAPI, client, fixtures, and version before Claude consumes a breaking or additive change.

## Ready-to-paste kickoff

Read `AGENTS.md`, `CLAUDE.md`, `docs/product-build-agreement.md`, `docs/architecture.md`, this handoff, `docs/integration-status.md`, and `packages/contracts/openapi.yaml`. You own the frontend only. Confirm the branch/commit/contract version. Build the complete responsive, accessible customer, mechanic, and admin frontend in `apps/web`, starting with catalog → vehicle → quote → Repair Room. Use the generated client and fixtures through one adapter; keep mock mode explicit and visibly development-only. Do not edit backend-owned files or invent missing endpoints. For unavailable backend areas, implement honest pending/error states and file contract requests. Run typecheck/tests and return exact results.
