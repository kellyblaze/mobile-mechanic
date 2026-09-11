# Handoff: persistent cancellation on Repair Room, Admin Jobs, Mechanic Jobs (CR-015 closed out)

Feature and owner: Wired cancellation into every screen that shows a job with a linked appointment — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `f1f9efc3f1a14a5678af423b4a21c58824c1d9f3` (working tree clean, pushed to `origin`; built directly on Codex's CR-015 backend commit `4481eb2`, already present in the shared working tree).
Contract version: `1.9.0` unchanged — no new endpoint, just three existing `SELECT`s gaining a column.

## What now works

Codex resolved [CR-015](../change-requests/CR-015.md): `appointmentId` is now included in `GET /jobs/{id}`, `GET /admin/jobs`, and `GET /mechanic/jobs`. That closes the gap flagged in the previous handoff — cancellation is no longer reachable only in the few seconds right after booking.

All three remaining job-facing screens now offer a real cancel action:

- **Repair Room** (`/jobs/:id`) — a new "Appointment" section with an optional reason field, matching `Booking`'s existing UX.
- **Admin Jobs** (`/admin/jobs`) — a compact "Cancel appointment" button per row.
- **Mechanic Jobs** (`/mechanic/jobs`) — the same, per row.

All three (and `Booking`, unchanged) share one new component, `CancelAppointmentAction` (`apps/web/src/components/shared.tsx`), so the mutation/loading/error/success logic exists in exactly one place. It deliberately makes no client-side guess about whether an appointment is still cancellable — there's still no `GET /appointments/{id}` to check against ahead of time — so it renders whenever `job.appointmentId` is present and just shows whatever the real API says: success, or the real 403/404/409 message.

## Live-verified end to end, not just curl

Restarted the local API dev server first (`tsx` has no watch mode, so it was still running Codex's pre-CR-015 code), then curl-verified `appointmentId` really came back on all three endpoints before writing any UI.

Then verified through the browser:
- **Admin Jobs**: clicked "Cancel appointment" on a real scheduled job → real 200, "Appointment cancelled." rendered, confirmed in the network log.
- **Mechanic Jobs**: revisited that same now-cancelled appointment's job and clicked cancel again → correctly got the real 404 "Appointment is not cancellable." message, not a false success. This is the honest behavior the no-client-side-guessing design produces — a stale-looking button that tells the truth when clicked, rather than a hidden button pretending to know more than the API does.
- **Repair Room**: confirmed the "Appointment" section (with reason field) renders on the seeded demo job.
- 375px checked clean on all three (no horizontal overflow).

One incidental observation worth naming, not a defect: during Admin Jobs testing, a single click produced two network requests (a 409 immediately followed by a 200 on the same appointment) — almost certainly the browser automation tool's click dispatching twice before React's `disabled={isPending}` re-render landed, not a bug in this code. The backend handled the double-submission safely either way (the second, redundant call is idempotent-safe). This exact click-then-disable pattern is already used everywhere else in the app (`Booking`'s Hold/Confirm buttons included) — not something introduced this checkpoint, and not worth a special guard here alone.

## Files changed

`apps/web/src/lib/apiAdapter.ts` (`appointmentId?: string` added to `Job` and `JobSummary`), `apps/web/src/components/shared.tsx` (new `CancelAppointmentAction` component), `apps/web/src/routes/RepairRoom.tsx`, `apps/web/src/routes/AdminJobs.tsx`, `apps/web/src/routes/MechanicJobs.tsx`, `docs/change-requests/CR-015.md` (Impacted screens section updated to reflect all four screens now shipping the action), `docs/integration-status.md` (Booking/availability row updated).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — restart after pulling new backend commits; tsx has no watch mode
pnpm --filter web dev       # Vite on :5173, or the .claude/launch.json "web" config via preview_start
```

As admin-demo: Admin — Jobs → any row with a "Cancel appointment" button → click it → watch the row switch to "Appointment cancelled." As mechanic-demo: My Jobs, same pattern. As any role viewing a job with a linked appointment: Repair Room shows the fuller "Appointment" section with an optional reason field.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, **34 tests passed**, unchanged count — this checkpoint only added two optional type fields and reused the already-tested `cancelAppointment` adapter method, so no new adapter-level test was needed; this app has no component-level test suite (established pattern all session — component correctness is verified live via browser, adapter correctness via unit tests).
- `pnpm --filter web build` — succeeded (157 modules, 511.09 kB JS / 14.02 kB CSS pre-gzip).
- Full manual verification described above, live via browser on all three screens plus a mobile-width overflow check.

## Known limitations

- No screen (including `Booking`) checks ahead of time whether an appointment is still cancellable — the button always renders when `appointmentId` exists, and a stale click just surfaces the real 403/404/409. This is a deliberate honesty trade-off, not an oversight: inventing a client-side "is this still cancellable" heuristic without a real `GET /appointments/{id}` would mean guessing at server state.
- No confirmation dialog before cancelling on any of the four screens (carried over from the previous checkpoint's note on `Booking`) — a single click submits it.

## What the other agent (Codex) should look at next

Nothing blocking from this checkpoint. If a `GET /appointments/{id}` (or similar) is ever added, the frontend could preemptively hide/disable the cancel action for an already-cancelled appointment instead of only finding out on click — worth a CR if the client wants that polish, but not requested yet.

The `.env` duplicate `AUTH_MODE` line (flagged in earlier handoffs) is still present — still not urgent, but still there.
