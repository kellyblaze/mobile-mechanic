# Handoff: frontend vertical slice 1

Feature and owner: Frontend foundation + first vertical slice (Homepage → My Garage → Repair Room), Claude.
Branch and commit SHA: `claude/frontend-foundation`, see `git log -1` at time of handoff (not yet merged to `feature/issue-1-backend-foundation`).
Contract version: `1.0.0` (`packages/contracts/openapi.yaml`), against backend commit `112f989`.

## What now works

- `apps/web`: Vite + React 18 + TypeScript + react-router + TanStack Query, scaffolded from nothing (was a placeholder README).
- Homepage: hero, three service entry doors ("Something's wrong" / "Tires & maintenance" / "Bodywork & paint"), live service catalog from `GET /service-catalog`.
- My Garage: real vehicle list (`GET /vehicles`) and vehicle creation form (`POST /vehicles`) with server-driven 422 field-error display.
- Repair Room: real job read (`GET /jobs/:id`), status/version/allowedActions display, quote acceptance (`POST /quotes/:id/accept`) with a real Idempotency-Key header and a verified 409 stale-version conflict path.
- Design system: graphite/warm-white/electric-teal tokens in `apps/web/src/styles.css`, mobile-first, verified at 360px, visible focus rings, `prefers-reduced-motion` support, 44px minimum touch targets.
- Dev-only role switcher (customer-demo/mechanic-demo/admin-demo), clearly labeled "not a real login," not a fabricated auth UI.
- Single API adapter (`apps/web/src/lib/apiAdapter.ts`) — no scattered fetch calls, no duplicated business rules, no hard-coded origins (reads `VITE_API_BASE_URL`, defaults to the documented local URL).

## Files and endpoint operations changed

New: `apps/web/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/lib/apiAdapter.ts`, `src/lib/apiAdapter.test.ts`, `docs/change-requests/CR-001.md`, `docs/handoffs/2026-09-08-vertical-slice-1.md`.
Edited: `docs/integration-status.md` (frontend/integration columns for the five implemented operations).
Endpoint operations exercised: `getSession` (unused in UI yet), `listServiceCatalog`, `listVehicles`, `createVehicle`, `getJob`, `acceptQuote`.
No backend-owned files touched (`apps/api`, `packages/domain`, `packages/database`, `packages/contracts/openapi.yaml`, generated client, migrations, root `package.json`).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000
pnpm --filter web dev       # Vite on :5173
```

Visit `http://localhost:5173`. Add a vehicle in My Garage; approve the quote in `/jobs/job-1`; click Approve again to see the real 409 conflict message.

## Tests run and actual results

- `pnpm typecheck` (root, NodeNext) — clean.
- `pnpm test` (root, vitest) — 2 files, 5 tests passed (`packages/domain/src/state.test.ts`, `apps/web/src/lib/apiAdapter.test.ts`).
- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web build` — succeeded (`vite build`, 212.81 kB JS / 4.24 kB CSS pre-gzip).
- Browser verification (Claude Browser pane): homepage catalog render, vehicle create round-trip against the live dev API, quote accept round-trip, real 409 on re-accept, 360px layout, console-error check (only the expected 409 network log — no app errors).
- Not run: Playwright/E2E suite (none exists yet), accessibility audit tooling (axe), keyboard-only walkthrough beyond visual focus-ring check.

## Known limitations / missing credentials

- Generated client (`packages/contracts/generated/client.ts`) has no POST/header support — `createVehicle`/`acceptQuote` call `fetch` directly against the documented contract as a stopgap (`docs/change-requests/CR-001.md`). Delete the stopgap once the client is regenerated.
- No managed authentication — dev headers only (`X-Dev-User-Id`/`X-Dev-Role`). Real sign-in/recovery/session-expiry UI (Claude's ownership per the agreement) is not built because there's no real auth backend to build it against yet.
- Everything past this slice is unbuilt: availability/booking, messages, findings, change orders, completion report, invoices, payments, admin/mechanic queues, Vehicle Passport history, phased/"Get My Car Right" plans. All contract-planned-only per `docs/integration-status.md`.
- No `packages/ui` package yet — design tokens live directly in `apps/web/src/styles.css`; deferred (YAGNI) until a second consuming app/package exists.
- `apps/web/package.json` and `packages/ui` (future) add dependencies that touched the shared `pnpm-lock.yaml`. Flagging per the ownership agreement's dependency-request process even though I applied it directly (no live Codex session to route the request through) — please review the lockfile diff for conflicts against any concurrent Codex work.

## What the other agent (Codex) must do next

1. Review/merge `claude/frontend-foundation` into the working branch; resolve `pnpm-lock.yaml` if Codex has made concurrent backend commits.
2. Action CR-001 (generated client mutation/header support) — or confirm the fetch-based stopgap is acceptable long-term.
3. Continue publishing contract operations for booking/availability, messages, findings, change orders, completion, invoices, payments, and `/vehicles/{id}/history` so the remaining required screens can move from "not started" to real integration.
4. No backend defects found in the five implemented operations — all behaved exactly per `openapi.yaml` and `docs/architecture.md` (role checks, validation, version-conflict, 404/403 paths all verified live).
