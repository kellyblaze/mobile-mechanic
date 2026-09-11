# Handoff: appointment cancellation wired into Booking, CR-015 filed

Feature and owner: Wired the real `POST /appointments/{id}/cancel` into the frontend — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `268f448586fff17361a666113f574a5c3ad73cd6` (working tree clean, pushed to `origin`).
Contract version: `1.9.0` unchanged — the endpoint was already published (backend commit `bc70e2d`, well before this checkpoint), just never called from the frontend until now.

## What now works

Right after a customer confirms a booking hold in `Booking` (`/book`), the page shows an optional reason field and a **"Cancel this booking"** button. Submitting it calls the real API and, on success, replaces the confirmed-booking UI with "Booking cancelled."

All five real outcomes are live-verified via curl before any UI was written, and re-verified through the browser end to end:

- **Success** — 200, returns the cancelled appointment (`status: 'cancelled'`, `cancelledAt`, `cancellationReason`).
- **Already cancelled** — 404 `NOT_FOUND`.
- **Non-participant actor** — 403 `FORBIDDEN`.
- **Inside the two-hour cutoff** (customer/mechanic) — 409 `CANCELLATION_CUTOFF`, shown via the real server message, not a guessed one.
- **Admin bypasses the cutoff** — 200 success even within two hours.

## A real gap found while building this — CR-015 filed

Cancellation is only reachable in the few seconds right after `confirmBookingHold` succeeds, because that's the *only* place in the entire API surface that ever hands the frontend an appointment id. `GET /jobs/{id}`, `GET /admin/jobs`, and whatever backs the mechanic job list all omit `appointment_id` from their `SELECT`s (confirmed by reading `apps/api/src/server.ts` and `packages/database/src/repositories.ts` directly), and there's no `GET /appointments` at all. So Repair Room, Admin Jobs, and My Jobs have no way to offer a cancel action for a job they're already looking at — filed [CR-015](../change-requests/CR-015.md) asking Codex to add `appointment_id AS "appointmentId"` to those SELECTs (at minimum `GET /jobs/{id}`).

This checkpoint's UI is real, not mocked, but it's intentionally thin until that's addressed — it doesn't overclaim "cancel your appointment" as a general capability anywhere in the app.

## Two bugs found and fixed live, not just wired from the spec

1. **This dev database was two migrations behind.** The first real cancel attempt 500'd: `column "cancelled_at" does not exist`. `packages/database/migrations/009_appointment_cancellation.sql` and `010_upload_completion.sql` were both present in the repo and correctly written (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), just never applied to this shared local database. Fixed by running the existing, already-committed `pnpm db:migrate` script (idempotent, tracks applied migrations in `schema_migrations`) — no source file touched, nothing off-limits edited.
2. **Stale mutation state, found via browser testing, not curl.** After cancelling one booking, every subsequent booking's confirmed-booking UI (and the cancel form itself) silently stayed hidden — `cancelAppointment.isSuccess` never reset, and the JSX gates on `confirmHold.isSuccess && !cancelAppointment.isSuccess`. Reproduced live: booked and cancelled once, then booked again and saw only "This time is available." with no confirmation message at all. Fixed by adding `cancelAppointment.reset()` (and clearing the reason field) to the same mechanic-select/start-time-change handlers that already reset `checkAvailability`/`createHold`/`confirmHold` — re-verified the fix live afterward.

## Files changed

`apps/web/src/lib/apiAdapter.ts` (new `CancelledAppointment` type, `cancelAppointment(id, reason?)` method), `apps/web/src/lib/apiAdapter.test.ts` (3 new tests), `apps/web/src/routes/Booking.tsx` (cancel form + the reset fix above), `docs/integration-status.md` (Booking row rewritten to describe the real, live-verified scope), `docs/change-requests/CR-015.md` (new).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — restart after pulling new backend commits; tsx has no watch mode
pnpm db:migrate             # idempotent — safe to run any time; catches a dev DB that's behind, as it was here
pnpm --filter web dev       # Vite on :5173, or the .claude/launch.json "web" config via preview_start
```

As customer-demo: Book → pick the mechanic-demo mechanic → pick a time → Check availability → Hold this slot → Confirm booking → the cancel form appears immediately below. Try a start time within two hours of now to see the real 409 cutoff message; try one further out to see a real success. Repeat the whole cycle a second time in the same session to confirm the reset fix (the confirmed-booking UI must reappear, not stay hidden).

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, **34 tests passed** (3 new: cancel-with-reason sends the right body, cancel-with-no-reason sends no body at all, a 409 surfaces as a typed `ApiRequestError` with `code: 'CANCELLATION_CUTOFF'`).
- `pnpm --filter web build` — succeeded (157 modules, 509.83 kB JS / 14.02 kB CSS pre-gzip).
- Full manual flow verified live via browser: booked and cancelled successfully (real 200, appointment disappeared into "Booking cancelled."); booked a second time and confirmed the confirmed-booking UI reappeared correctly after the reset fix; triggered and displayed the real 409 cutoff message; confirmed no horizontal overflow at 375px.

## Known limitations

- Cancellation is not reachable from Repair Room, Admin Jobs, or My Jobs — blocked on CR-015.
- No confirmation dialog before cancelling — a single click submits it. Not flagged as a defect since nothing in the handoff asked for one, but worth a design call if the client wants a safety step before an irreversible action.
- The mechanic role isn't gated out of `/book` today (pre-existing, not introduced this checkpoint) — worth a follow-up look at whether mechanics should be able to reach the booking form at all, separate from this cancellation work.

## What the other agent (Codex) should look at next

1. **CR-015** — expose `appointmentId` on `GET /jobs/{id}` (and ideally the admin/mechanic job list endpoints) so a persistent cancel action can be built where jobs are actually viewed, not just in the booking-confirmation moment.
2. The `.env` duplicate `AUTH_MODE` line (flagged in the previous handoff, still present) — not urgent, but still there.

No backend defects found in `POST /appointments/{id}/cancel` itself — it behaved exactly as `packages/database/src/repositories.ts` describes for every outcome tested, once the dev database was current.
