# Claude handoff: connect the admin Monitoring UI to the real API

## Repository and handoff state

- Repository: `E:\Projects\Mobile Mechanic`
- Branch: `feature/issue-2-backend-completion`
- Backend handoff commit: `bc70e2df87c1c8afb192f8029412ed8b558a461c`
- Remote branch: `origin/feature/issue-2-backend-completion`
- OpenAPI contract: `packages/contracts/openapi.yaml`, version `1.9.0`
- Generated client: `packages/contracts/generated/client.ts`

## Objective

Replace the admin Monitoring UI’s explicit mock data with the Mobile Mechanic admin monitoring proxy. The client must remain inside the Mobile Mechanic app and must never call GlitchTip directly.

## Claude ownership

Claude may modify only:

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
- authentication, authorization, or payment rules
- `.env` files or secret-bearing configuration

If the UI needs a contract change, create a new `docs/change-requests/CR-###.md` and stop at the honest pending state.

## Real monitoring endpoints

All endpoints require an authenticated admin session. Customer and mechanic requests must receive `403`.

- `GET /api/v1/admin/monitoring/overview`
- `GET /api/v1/admin/monitoring/issues`
- `GET /api/v1/admin/monitoring/issues/{id}`
- `GET /api/v1/admin/monitoring/webhooks`
- `GET /api/v1/admin/monitoring/reconciliation`
- `GET /api/v1/admin/monitoring/uptime`

Use the generated client or the existing single frontend API adapter. Do not add direct GlitchTip requests.

## Provider configuration

The API requires these server-only variables for GlitchTip issue list/detail data:

```env
GLITCHTIP_API_URL=https://app.glitchtip.com
GLITCHTIP_API_TOKEN=<server-only-token>
GLITCHTIP_ORG_SLUG=<organization-slug>
GLITCHTIP_PROJECT_SLUG=<project-slug>
```

Do not place `GLITCHTIP_API_TOKEN` in `apps/web/.env`, browser code, fixtures, or network request headers. If provider configuration is absent, issue endpoints return `503 MONITORING_UNAVAILABLE`; the UI must render an honest unavailable state.

## UI requirements

Update the existing routes:

- `/admin/monitoring` — overview cards and stale/error states.
- `/admin/monitoring/issues` — filters for severity, status, environment, release, and pagination.
- `/admin/monitoring/issues/:id` — safe issue detail and stack-trace summary.
- `/admin/monitoring/operations` — webhook, reconciliation, and uptime status.

Remove or clearly disable the `MOCK MODE` banner only when real API mode is active. Keep an explicit mock mode available for local development when the API provider is unavailable.

Required states:

- loading
- empty
- unauthorized
- provider unavailable (`503`)
- server error
- retry
- stale data
- pagination exhausted

## Security requirements

- Preserve the admin gate in navigation and direct URL access.
- Do not expose GlitchTip DSNs, API tokens, Stripe secrets, Supabase service-role keys, access tokens, signed upload URLs, raw customer-upload contents, or unredacted customer identifiers.
- Treat all monitoring response text as untrusted display data.
- Do not send monitoring provider credentials from the browser.

## Verification

Run:

```powershell
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Manually verify:

- admin sees real monitoring data when API configuration is available;
- customer and mechanic receive an admin-only state;
- missing provider configuration produces a clear unavailable state;
- filters and pagination work;
- retry works after a simulated API failure;
- no direct GlitchTip browser request occurs;
- no secret appears in browser source, local storage, or network payloads.

## Ready-to-paste Claude prompt

You are continuing the frontend-only Mobile Mechanic monitoring task.

Read `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/production-hardening.md`, `docs/frontend-handoff.md`, `docs/change-requests/CR-014.md`, and this handoff file.

Work from branch `feature/issue-2-backend-completion` at commit `bc70e2df87c1c8afb192f8029412ed8b558a461c`. Replace the Monitoring UI’s mock data with the published admin-only Mobile Mechanic monitoring proxy endpoints in OpenAPI v1.9.0. Modify only `apps/web/**` and frontend-only UI/test/assets files. Do not modify backend, database, migrations, OpenAPI, generated client, auth, authorization, secrets, or root tooling.

Use the existing API adapter/generated client boundary. Never call GlitchTip directly from the browser. Preserve explicit mock mode and show a clear unavailable state when the API returns `503 MONITORING_UNAVAILABLE`. Implement loading, empty, unauthorized, error, retry, stale-data, filtering, pagination, and responsive accessible states.

Run `pnpm --filter web typecheck`, `pnpm --filter web test`, and `pnpm --filter web build`. Report exact files changed, whether real or mock mode was verified, unresolved contract requests, and the final commit SHA.
