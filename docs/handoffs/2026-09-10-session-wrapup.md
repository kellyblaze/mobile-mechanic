# Handoff: session wrap-up — all 13 change requests resolved and verified

Feature and owner: Full frontend build-out this session — admin/mechanic screens, real sign-in, invoices, payments, booking/availability, and thirteen change requests filed and (mostly) closed in back-and-forth with Codex — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `370924f65d26e4834f18a1d60fb820f2e48a3526` (working tree clean, pushed to `origin`).
Contract version: `1.7.0` (`packages/contracts/openapi.yaml`).

## What this session covered, start to finish

This was one long checkpoint chain, not a single feature. In order:

1. Verified two of Codex's fixes (vehicle history, `.env` auth mode), then built the admin/mechanic screens (`MechanicJobs`, `AdminJobs`, `AdminIssueQuote`, mechanic-only Repair Room controls) against the backend Codex had just shipped.
2. Wired up real invoices (read-only at that point).
3. A polish pass that found and fixed two real bugs (a silent `NaN`→`null` submission bug, a mobile layout overlap) while cleaning up rough edges.
4. Real sign-in via Supabase Auth — deliberately sign-in only, since self-serve sign-up had no working path to a usable account (see CR-007 below).
5. Filed CR-006/CR-007 for gaps found while building the above; Codex resolved both; wired the resulting `GET /admin/service-requests` picker and `POST /admin/memberships` provisioning screen. Found and filed CR-008 (quoting a request didn't change its status) while doing that; Codex resolved it same-day.
6. Built real Stripe payment collection and real booking/availability — genuinely blocked at first (no invoice existed to pay, no way to discover a mechanic to book), so filed CR-009 through CR-012. Codex resolved all four. Wired the results and, critically, this is where verification finally went from partial to complete: every screen was clicked through live against the real API, not just curled.
7. Found and fixed two more real bugs while doing that live verification (both mine, both frontend — see below), and found/filed CR-013 (a duplicate-rows/cross-tenant bug in the new mechanics endpoint). Codex resolved it; removed the now-unnecessary client-side workaround.

## All change requests filed this session

| CR | What | Status |
|---|---|---|
| 001 | Generated client has no POST/header support | Implemented in contract 1.1.0. Frontend still uses the documented hand-rolled adapter (`apps/web/src/lib/apiAdapter.ts`) rather than the generated client — see "What's still open" below; this was a deliberate ongoing choice, not an oversight. |
| 002 | Job needs a linked quote id/version | Implemented. **Note**: `CR-002.md`'s own status line still says "frontend cleanup remains" — that's stale; the frontend cleanup (removing the hardcoded `quote-1`/`expectedVersion: 1`) was completed early this session, verified live at the time. |
| 003 | `/vehicles/{id}/history` | Implemented and wired. |
| 004 | `/jobs/{id}/findings`, `/jobs/{id}/messages` | Implemented and wired. |
| 005 | `/service-requests`, `/uploads` | Implemented; real upload storage still pending (uploads remain metadata-only — confirmed live via curl this session too). |
| 006 | Admin service-request discovery | Implemented and wired — real picker on `AdminIssueQuote`. |
| 007 | New Supabase users had no path to a usable account | Resolved as "provisioned accounts": sign-in only, `POST /admin/memberships` links an existing account to a role. Wired as `AdminProvisionMembership`. |
| 008 | Quoting a request didn't change its status | Implemented and verified — picker correctly excludes quoted requests now. |
| 009 | Payments had no invoice linkage | Implemented and wired — `PayInvoice` passes `invoiceId`; verified with a real Stripe test-card payment. |
| 010 | No endpoint created an invoice | Implemented and wired — new `AdminIssueInvoice` screen. |
| 011 | No mechanic-listing endpoint | Implemented and wired — real picker on `Booking`. |
| 012 | Booking holds never became appointments | **Marked "partially implemented" in `CR-012.md`**, but live-verified this session that `POST /booking-holds/{id}/confirm` creates both a confirmed appointment *and* a scheduled job in one transaction — clicked all the way through in the browser and saw the real job. The file's "remaining: appointment-to-job creation" note appears to predate that. Worth Codex double-checking the file against the actual shipped behavior. |
| 013 | `GET /mechanics` duplicates / no business scope | Implemented and verified — one row now, correctly scoped. Client-side dedup workaround removed. |

## Two real bugs found and fixed this session — both frontend, both mine

1. **`apiAdapter.ts` always sent `Content-Type: application/json`**, even for no-body POSTs (`confirmBookingHold`, `refundPayment`). Fastify's strict JSON parser rejects an empty body with that header present. Found via a genuine 500 on the confirm-booking flow, root-caused from the actual server log line, fixed, regression-tested.
2. **`invoice.totalMinor` is returned by the API as a JSON string**, not a number, despite the `Invoice` type declaring `number`. Sending it straight through in a new request body (`POST /payments`) silently became a JSON string, which the server's `z.number()` check rejected with a 422. Fixed with `Number(...)` at the one call site that re-serializes it; documented the quirk on the type itself.

Neither needed a Codex change — both are entirely within `apps/web/**` — but they're real defects that would have shipped without the live-verification discipline this session held to throughout.

## What's fully verified live, end to end, through the actual UI

Sign-in (real Supabase Auth, error path), admin/mechanic screens (quote issuance, membership provisioning, job transitions, findings, completion reports), booking (mechanic picker → availability → hold → confirm → real appointment + job), admin invoice issuance, and a real Stripe test-mode payment through the actual embedded card form. All of this was clicked through in the browser via `preview_start`, not assumed from curl or code review alone — see the individual per-checkpoint handoff docs in `docs/handoffs/` for the specific verification steps and dates.

## What's still open

- **CR-001's frontend half**: the hand-rolled `apiAdapter.ts` still doesn't delegate to the generated client (`packages/contracts/generated/client.ts`), because that client still has no POST/header support. Low urgency — the adapter works and is well-documented — but worth Codex knowing it's not forgotten.
- **Real object storage for uploads** (CR-005's remaining half): `POST /uploads` still returns `status: "pending_local_adapter"` with no real upload URL. The Tap Your Trouble photo step still can't send real bytes.
- **Cancellation/rescheduling**: no frontend or backend path for either, for a confirmed booking or an issued quote.
- **Sign-up**: deliberately not built (see CR-007) — the resolved policy is admin-provisioned access, not open self-registration, so there's no product need for one unless that policy changes.
- **Payment → paid-invoice confirmation**: the linkage is implemented and the payment step itself is verified genuine, but the downstream webhook-driven status flip to `"paid"` was not observed live this session (requires `stripe listen` running locally, which wasn't active during testing).
- **`JobTransition.status`** remains a free-text contract field with no enum — the mechanic status-update field on Repair Room is a plain text input for that reason, not a dropdown.

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — tsx has no watch mode, restart after pulling new backend commits
pnpm --filter web dev       # Vite on :5173, or use the .claude/launch.json "web" config via preview_start
```

The dev-role switcher (customer-demo/mechanic-demo/admin-demo) covers every screen without needing real credentials. For real sign-in, populate `apps/web/.env` from `.env.example` (gitignored) with Supabase and Stripe test keys.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, 25 tests passed.
- `pnpm --filter web build` — succeeded (152 modules, ~495 kB JS / 14 kB CSS pre-gzip).

## What the other agent (Codex) should look at next

1. Double-check `CR-012.md` and `CR-002.md`'s status notes against actual shipped behavior — both read as slightly stale relative to what's live-verified working (see the table above).
2. CR-001's frontend cleanup and CR-005's real upload storage are the two oldest still-open items — both from early in the session, still real gaps.
3. Everything else filed this session (CR-006 through CR-013) is resolved and wired; no further action needed there barring the CR-012 note above.

No unresolved backend defects found in anything exercised this session beyond what's listed in the table. This is a reasonable stopping point — every screen either works end to end or has an honest, disclosed reason it doesn't yet.
