# Claude handoff: Mobile Mechanic admin monitoring UI

## Objective

Build an admin-only monitoring area inside the Mobile Mechanic web app so the client does not need to sign in to GlitchTip separately.

## Repository state

- Repository: `E:\Projects\Mobile Mechanic`
- Branch: `feature/issue-2-backend-completion`
- Handoff commit: `062d9a7ce661736e74efbcbf44563256ba753fc7`
- Remote: `origin/feature/issue-2-backend-completion`
- Frontend runs with `pnpm --filter web dev`.
- API runs with `pnpm dev`.
- Current frontend URL may use the next available Vite port if 5173 is occupied.

## Ownership boundary

Claude may modify:

- `apps/web/**`
- frontend-only files under `packages/ui/**`
- frontend tests and frontend assets

Claude must not modify:

- `apps/api/**`
- `packages/database/**`
- `packages/domain/**`
- `packages/contracts/openapi.yaml`
- `packages/contracts/generated/**`
- migrations
- authentication or authorization rules
- GlitchTip API tokens or secret environment variables
- root dependency/tooling files without an explicit contract-change request

The backend proxy contract must be requested from Codex if it is not already published. Do not call GlitchTip directly from the browser with an organization token.

## Product scope

Add an admin navigation entry such as `Monitoring` with these screens:

1. Overview
   - API health
   - active incidents/issues
   - recent webhook failures
   - payment reconciliation warnings
   - booking conflict count
   - current release/environment

2. Issues
   - issue list
   - severity/status filters
   - environment and release filters
   - pagination or cursor loading
   - issue detail with message, route, timestamp, count, and stack trace summary

3. Operations
   - webhook delivery status
   - payment reconciliation lag
   - database/API health
   - uptime monitor status

4. Access states
   - loading
   - empty state
   - unauthorized/non-admin
   - API unavailable
   - stale data warning
   - retry action

## Security requirements

- Monitoring screens are admin-only.
- Do not put a GlitchTip auth token, organization token, or private API credential in frontend code.
- Use the existing API adapter and authenticated Mobile Mechanic session.
- Never display Stripe secret keys, webhook signing secrets, Supabase service-role keys, access tokens, signed upload URLs, or raw customer-upload contents.
- Redact customer email, phone, VIN, payment identifiers, and request payloads unless the backend contract explicitly provides a safe masked field.
- Keep the GlitchTip DSNs out of issue detail payloads. DSNs are telemetry routing values, not API credentials.

## Backend dependency

The UI should use a Mobile Mechanic API proxy, not GlitchTip directly. Expected future operations are:

- `GET /admin/monitoring/overview`
- `GET /admin/monitoring/issues`
- `GET /admin/monitoring/issues/{id}`
- `GET /admin/monitoring/uptime`
- `GET /admin/monitoring/webhooks`
- `GET /admin/monitoring/reconciliation`

These endpoints are not yet published in the current contract. Until Codex publishes them, use explicit frontend mock fixtures labeled `MOCK MODE` and do not invent response shapes in production adapter code.

If the backend contract is missing, create `docs/change-requests/CR-014.md` containing the exact screen need, request query parameters, response fields, permissions, pagination, redaction rules, and acceptance tests. Do not edit OpenAPI or backend files.

## Suggested UI data shapes

Use only after Codex publishes the contract:

```ts
type MonitoringSummary = {
  environment: string;
  release?: string;
  api: { status: 'healthy' | 'degraded' | 'down'; checkedAt: string };
  issues: { open: number; critical: number; last24Hours: number };
  webhooks: { failed: number; oldestPendingAt?: string };
  reconciliation: { unpaidSucceededPayments: number; oldestLagMinutes?: number };
};
```

Do not add fields or statuses to the real adapter without a contract change.

## Environment behavior

- Development may use local fixtures with a clearly visible `MOCK MODE` label.
- Production must use the authenticated Mobile Mechanic API proxy.
- Do not expose `SENTRY_DSN` or GlitchTip API credentials as a substitute for the proxy.
- Existing local frontend configuration is in `apps/web/.env`, which is ignored by Git.

## Verification

Run from the repository root:

```powershell
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Also verify manually:

- customer cannot see the Monitoring navigation or routes;
- mechanic cannot see the Monitoring navigation or routes;
- admin can open the Monitoring area;
- mock mode is visibly labeled;
- loading, empty, unauthorized, error, and retry states are usable;
- no secret or raw sensitive payload appears in the browser network response.

## Ready-to-paste Claude prompt

You are taking over the frontend-only monitoring UI task for Mobile Mechanic.

Read `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/production-hardening.md`, `docs/frontend-handoff.md`, and this file: `docs/handoffs/2026-09-10-monitoring-admin-ui-claude.md`.

Work on branch `feature/issue-2-backend-completion` from commit `062d9a7ce661736e74efbcbf44563256ba753fc7`.

Modify only `apps/web/**` and frontend-only UI/test/assets files. Do not modify backend, database, migrations, OpenAPI, generated client, auth, authorization, secrets, or root tooling. Build the admin Monitoring UI with explicit mock mode until Codex publishes the monitoring proxy contract. Do not call GlitchTip directly from the browser and do not put provider credentials in frontend code.

Implement the Monitoring navigation, overview, issues, operations, loading/empty/error/unauthorized/retry states, and responsive accessible layouts. If the backend contract is missing, create `docs/change-requests/CR-014.md` only and keep the UI honest and visibly mocked.

Run `pnpm --filter web typecheck`, `pnpm --filter web test`, and `pnpm --filter web build`. Report exact files changed, whether mock or real API mode was used, unresolved contract requests, and the final commit SHA.
