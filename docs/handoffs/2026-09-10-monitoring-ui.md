# Handoff: admin monitoring UI built (mock mode, CR-014 filed)

Feature and owner: Admin-only Monitoring UI per `docs/handoffs/2026-09-10-monitoring-admin-ui-claude.md` — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `605eec4c09c1f57a159685dc2ed74deaa151b91a` (working tree clean, pushed to `origin`).
Contract version: `1.7.0` unchanged — nothing here required a contract change; CR-014 is filed for the real proxy this depends on.

## What now works

Four new admin-only routes, built entirely against explicit mock fixtures (`apps/web/src/lib/monitoringMockData.ts`) since no `/admin/monitoring/*` proxy exists yet — grepped the whole repo to confirm before writing anything:

- **`MonitoringOverview`** (`/admin/monitoring`) — environment/release, API status, open/critical issue counts, webhook failures, unreconciled payments, booking conflicts. Includes a genuine stale-data warning (the mock `checkedAt` is deliberately 12 minutes old).
- **`MonitoringIssues`** (`/admin/monitoring/issues`) — filterable by severity/status/environment, links to detail.
- **`MonitoringIssueDetail`** (`/admin/monitoring/issues/:id`) — message, route, occurrence counts, and a stack-trace summary with customer-identifying fields shown as already-redacted, matching what a real proxy response would have to do server-side.
- **`MonitoringOperations`** (`/admin/monitoring/operations`) — webhook delivery status, payment reconciliation lag, uptime checks.

Every screen shows a visible **MOCK MODE** banner and includes a "simulate a failure" toggle so the error/retry states are genuinely clickable, not just present in code.

## Change request filed

**CR-014** (`docs/change-requests/CR-014.md`): the six `/admin/monitoring/*` endpoints the handoff doc specified, with the exact `MonitoringSummary` shape, issue list/detail fields, filters, pagination, and the security/redaction requirements (no GlitchTip DSN, no secrets, customer-identifying fields must be redacted server-side before reaching the frontend).

## Security requirements — verified, not just followed by convention

- **Admin-only, enforced client-side for real**: since there's no backend to 403 a customer/mechanic hitting these URLs directly (it's mock data), built a real `AdminOnlyGate` component. Live-verified both roles see "This area is for admins only" via the nav (link hidden) *and* direct URL navigation (the actual gate content, not a blank page).
- **Nothing leaves the browser**: confirmed via the network log that zero requests fire for any monitoring data — there's nothing to redact-leak because nothing is ever sent anywhere.
- No GlitchTip DSN, Stripe secret, Supabase service-role key, or other credential appears anywhere in the mock data or the four route files.

## Files changed

`apps/web/src/lib/monitoringMockData.ts` (new), `apps/web/src/routes/Monitoring{Overview,Issues,IssueDetail,Operations}.tsx` (new), `apps/web/src/components/shared.tsx` (added `AdminOnlyGate` and `MockModeBanner`; widened `ErrorPanel` to also read a plain `Error`'s message — additive, existing `ApiRequestError` handling unchanged), `apps/web/src/App.tsx` (four routes + nav link), `docs/change-requests/CR-014.md` (new), `docs/integration-status.md` (new row).

## How to run and verify

```powershell
pnpm --filter web dev       # Vite on :5173, or use the .claude/launch.json "web" config via preview_start
```

As customer-demo or mechanic-demo: confirm no "Monitoring" nav link, and confirm `/admin/monitoring` directly shows "for admins only." As admin-demo: My Garage nav → Monitoring → click through Issues (try filtering to something with no matches), an issue detail, Operations, and the "simulate a failure" toggle on each screen.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, 25 tests passed (unchanged — this feature has no adapter methods to unit test, since it's mock-only by design).
- `pnpm --filter web build` — succeeded (157 modules, 507.37 kB JS / 14.00 kB CSS pre-gzip; Vite's chunk-size advisory triggered for the first time this session, non-blocking).
- Manual checklist from the handoff doc fully verified live: role gating (nav + direct URL, both roles), mock mode labeling, loading/empty/unauthorized/error/retry/stale-data states, and no network egress. One thing found and ruled out: a transient ~35px mobile overflow traced to Stripe.js's own hidden telemetry iframes settling after page load — present globally (even on Home), unrelated to this feature, resolves within ~1.5s.

## Noted while reviewing, not yet actioned this checkpoint

While reviewing the repo state for this task, found two things Codex shipped that aren't wired into the frontend yet — flagging rather than building them now, since they weren't part of this task:

- **`POST /appointments/{id}/cancel`** — appointment cancellation (two-hour notice policy for customers/mechanics, admins can cancel any future appointment; refunds stay admin-controlled). No frontend UI for this yet — `Booking`'s confirmed-appointment success state has no cancel action.
- **`POST /uploads/{id}/complete`** — uploads now return a real short-lived signed Supabase Storage URL, not the `pending_local_adapter` stub this session's earlier work found. The Tap Your Trouble photo step (`Intake.tsx`) still has the upload flow explicitly disabled from that earlier finding and needs re-checked against this.
- Also noted (not yet re-verified): `docs/integration-status.md`'s Payments row was separately updated to say a full Stripe webhook cycle (invoice → paid) completed successfully — resolving the one gap flagged as unverified in the prior session wrap-up.

## What the other agent (Codex) should look at next

No action needed on Codex's side for this checkpoint — CR-014 is the only new ask, and it's clearly scoped. The two items above are frontend follow-up work, not backend gaps.
