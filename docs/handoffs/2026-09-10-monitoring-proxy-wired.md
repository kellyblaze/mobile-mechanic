# Handoff: real monitoring proxy wired (CR-014 resolved), two bugs found and fixed

Feature and owner: Connected the admin Monitoring UI to the real `/admin/monitoring/*` proxy per `docs/handoffs/2026-09-10-monitoring-proxy-claude.md` — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `fe433680858041adc2269a9ed2a5f154aba4175f` (working tree clean, pushed to `origin`).
Contract version: `1.9.0` unchanged — nothing here required a further contract change.

## What now works

All four Monitoring screens (`/admin/monitoring`, `/issues`, `/issues/:id`, `/operations`) call the real proxy by default:

- **Overview, webhooks, reconciliation, uptime** — fully live, database-backed, no GlitchTip credentials needed. Live-verified real data renders (all zero/healthy, matching this dev database's actual state).
- **Issues list/detail** — correctly 503 `MONITORING_UNAVAILABLE` in this dev environment (no `GLITCHTIP_API_URL`/`TOKEN`/`ORG_SLUG`/`PROJECT_SLUG` set), and the UI shows a distinct, honest "GlitchTip isn't configured" message rather than a generic error.
- Every screen keeps an explicit, dev-only **"Use mock data"** checkbox, per the handoff's request to preserve mock mode for local preview without a configured provider — mock and real data now render through identical UI code, since `monitoringMockData.ts` was rewritten to reuse the exact real types.
- A **"simulate a server error"** toggle, distinct from the real 503 path, exercises the generic error/retry state on demand.

## CR-014 closed out

Updated `docs/change-requests/CR-014.md`'s status to reflect the frontend is now wired and live-verified against the real proxy, not mock-only.

## Two real bugs found and fixed while verifying live — both mine, both frontend

1. **Query keys omitted `actorKey`.** All four screens' React Query keys didn't include the current actor, so switching the dev-role selector from customer to admin didn't trigger a refetch — the overview kept showing customer's cached 403 instead of fetching fresh as admin. Found by switching roles live and seeing the stale error persist. Fixed by adding `actorKey` to every monitoring query key, matching the pattern already used everywhere else in this app.
2. **Unbroken string overflow at 375px.** The real "not configured" message contains `GLITCHTIP_API_URL/TOKEN/ORG_SLUG/PROJECT_SLUG` with no wrap point, pushing the whole page into horizontal scroll (confirmed via `scrollWidth`: 439px in a 375px viewport). Fixed with `overflow-wrap: anywhere` on the shared `.pending-note` class — additive, no visual change for normal space-separated text.

## Found, not fixed — flagging only

`.env` currently has **two conflicting `AUTH_MODE` lines** — `development` first, then `managed` later in the file (the later one wins), which silently re-blocks the plain `X-Dev-User-Id`/`X-Dev-Role` header workflow this session already fixed once before (see the very first handoff this session). Did not touch `.env` per the ownership boundary; used a process-level `AUTH_MODE=development` override for this checkpoint's own verification only, same technique as the original fix. Worth cleaning up the duplicate line whenever convenient — not urgent, but it'll bite the next person who runs `pnpm dev` expecting dev headers to work.

## Files changed

`apps/web/src/lib/apiAdapter.ts` (6 new types, 6 new methods), `apps/web/src/lib/monitoringMockData.ts` (rewritten to match real shapes), `apps/web/src/routes/Monitoring{Overview,Issues,IssueDetail,Operations}.tsx` (real API + mock toggle + query-key fix), `apps/web/src/styles.css` (overflow-wrap fix), `apps/web/src/App.tsx` (passes `api` prop through), `apps/web/src/lib/apiAdapter.test.ts` (6 new tests), `docs/change-requests/CR-014.md`, `docs/integration-status.md`.

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — restart after pulling new backend commits; tsx has no watch mode here
pnpm --filter web dev       # Vite on :5173, or use the .claude/launch.json "web" config via preview_start
```

Note: if `.env`'s duplicate `AUTH_MODE` line hasn't been cleaned up, dev headers need `AUTH_MODE=development pnpm dev` to work locally (see above). As admin-demo: My Garage nav → Monitoring → overview (real data), Issues (real 503 unless GlitchTip is configured; check "Use mock data" to preview with sample issues), an issue detail, Operations.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, 31 tests passed (6 new, including one asserting a 503 response surfaces as a typed `ApiRequestError`).
- `pnpm --filter web build` — succeeded (157 modules, 508.99 kB JS / 14.02 kB CSS pre-gzip).
- Full manual checklist from the handoff doc verified live: role gating (nav + direct URL, both non-admin roles), real data rendering, the distinct provider-unavailable state, mock-mode toggle, retry, and no secret/token/DSN anywhere in source, network payloads, or localStorage (all checked directly, not assumed).
- **Not verified**: real GlitchTip issue data rendering end-to-end — no `GLITCHTIP_*` credentials are configured in this dev environment, so the issue endpoints could only be exercised against their real 503 path, not a real populated response. Confirmed the code path is correct by reading the server handler directly (field mapping, redaction), but it was never observed against live GlitchTip data.

## What the other agent (Codex) should look at next

1. The `.env` duplicate `AUTH_MODE` line, whenever convenient — not urgent, but worth a clean-up pass.
2. If/when `GLITCHTIP_*` credentials get configured somewhere (staging or otherwise), worth a follow-up live check of the issues list/detail against real data — everything here was built and verified as far as this dev environment allows, but that specific path remains unobserved.

No backend defects found in the six monitoring endpoints themselves — all behaved exactly as their own code describes when exercised live, repeatedly.
