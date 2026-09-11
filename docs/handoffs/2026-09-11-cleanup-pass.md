# Handoff: frontend check-and-cleanup pass — two real bugs found and fixed

Feature and owner: Systematic audit of `apps/web/**` for bugs, dead code, and inconsistencies — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `3bd23a4b16e437671e80888398ffdf7f09eba75c` (my files clean and pushed to `origin`; a few backend/contract files show local, uncommitted changes from Codex working concurrently in this shared repo — untouched by me, see below).
Contract version: `1.9.0` unchanged — this checkpoint touched no contract-facing behavior.

## Scope note

The user first asked about upgrading `react-router-dom` from v6 to v7 (open security advisories). Per their explicit direction, that's been split off as its own background-task suggestion rather than bundled here — it touches every route in the app and needs real regression testing, not an ad-hoc cleanup-pass change. This handoff covers only the check-and-cleanup pass that followed.

## What was checked

Ran `pnpm --filter web typecheck/test/build` as a baseline (clean), then systematically reviewed every route file (`App.tsx` and all of `apps/web/src/routes/*.tsx`), `components/shared.tsx`, and `styles.css`:

- Grepped for `console.log`/`TODO`/`FIXME` markers — none found.
- Checked every `.map()`-rendered list for a proper `key` prop — all correct (no index-as-key anti-pattern anywhere).
- Cross-checked every `useQuery` call's `queryKey` against whether its `queryFn` actually depends on the calling actor (by reading the corresponding `apps/api/src/server.ts` handler) — found one real gap (see below); every other query already includes `actorKey` where the response is genuinely actor-scoped, and correctly omits it where the endpoint is genuinely global (`Home.tsx`'s `service-catalog` query, confirmed via `GET /service-catalog`'s handler taking no `request`/auth parameter at all).
- Read every remaining route file not closely touched this session (`PayInvoice`, `AdminIssueInvoice`, `Vehicles`, `AdminProvisionMembership`, `VehiclePassport`, `Home`, `SignIn`, `useSupabaseSession`) for the same class of issue — all clean.

## Two real bugs found and fixed

1. **Stale cross-actor cache in `Booking.tsx`.** The mechanics-list query used `queryKey: ['mechanics']` with no actor scoping at all, even though `GET /mechanics` is business-scoped per caller server-side (`bookingRepository.listMechanics(a.id)`, confirmed by reading `server.ts`). This is the exact same defect class already found and fixed once this session in the Monitoring screens — a different actor loading `/book` would have silently seen a stale, wrong-business mechanic list instead of a fresh fetch. Fixed by adding `actorKey` to `Booking`'s props (passed from `App.tsx`) and the query key. Live-verified: switching the dev-role selector on `/book` now fires a real new `GET /mechanics` request instead of reusing the cached result.

2. **CSS collision in `Intake.tsx`'s photo-error state.** The Retry button added in the previous (real-photo-uploads) checkpoint was a plain, unclassed `<button>` inside `.intake-photo-list li` — which meant it inherited `.intake-photo-list button`'s rule (absolute-positioned, 22px circle, top-right corner), the exact same styling meant only for the "×" remove button next to it. The two buttons would have rendered stacked directly on top of each other, "Retry" text overflowing a 22px circle. Fixed with a scoped `.intake-photo-list .intake-photo-retry` override. Worth noting: my first attempt at this fix used a single-class `.intake-photo-retry` selector, which has *lower* CSS specificity than `.intake-photo-list button` (class+element beats a lone class) and would have silently done nothing — caught before shipping it via a `getComputedStyle` check on a scratch DOM element, not just trusted the CSS on sight.

## One gap closed alongside the fixes

Added the missing client-side file-size check to `Intake.tsx`'s photo picker (25 MB, matching the server's own real `uploadSchema.sizeBytes.max(25000000)`). The content-type check already existed; size didn't, so an oversized photo previously only found out via a real 422 after attempting the full upload instead of immediately.

## Findings reported, not fixed

Flagged rather than unilaterally expanding scope beyond what was asked:

- `/book` and `/intake/:category` have no client-side role gate — a mechanic/admin can navigate there directly and fill out the whole form before hitting a real 403 on submit. Not a security issue (the server enforces it either way), just inconsistent with the `AdminOnlyGate` pattern Monitoring already established. Worth a design call on whether that consistency is wanted here too.
- `Vehicles.tsx`'s year/mileage inputs have no client-side `Number.isFinite` guard before submit, unlike `AdminIssueQuote`'s amount field. Native `required` still blocks empty submission, and a bad value still 422s with a real, decent field-error message today — not broken, just a minor inconsistency.
- `.env`'s duplicate `AUTH_MODE` line, flagged in multiple earlier handoffs, is still present. Off-limits for me to touch.

## A concurrent-work note, not a finding

`apps/api/src/server.ts`, `packages/contracts/generated/client.ts`, and `packages/contracts/openapi.yaml` all showed local, uncommitted changes during this pass — Codex appears to be mid-flight on a new `GET /uploads/:id` endpoint (a signed-download URL, scoped to the owner/admin/relevant mechanic) that resolves part of [CR-018](../change-requests/CR-018.md)'s first limitation (no way to view an uploaded file's content). Left entirely untouched — not staged, not committed, not read beyond a quick `git diff` to understand what was there. Worth picking up frontend-side once Codex commits it and it's live-verifiable.

## Files changed

`apps/web/src/App.tsx` (passes `actorKey` to `Booking`), `apps/web/src/routes/Booking.tsx` (actorKey fix), `apps/web/src/routes/Intake.tsx` (CSS-collision fix's JSX half, plus the file-size check), `apps/web/src/styles.css` (the CSS override).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000
pnpm --filter web dev       # Vite on :5173, or the .claude/launch.json "web" config via preview_start
```

As customer-demo: `/book` → note the mechanics list loads → switch the dev-role selector to admin-demo without navigating away → confirm a fresh `GET /mechanics` fires (visible in network requests) rather than nothing happening. For the CSS fix, the actual photo-error state still can't be triggered through this session's browser tool (no file-picker support — see the 2026-09-11 real-photo-uploads handoff for that limitation); it was verified via a `getComputedStyle` check instead, described above.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, **39 tests passed**, unchanged count — this pass fixed bugs and added one validation check, neither of which needed new adapter-level tests (no new adapter method or type; both fixes are UI/component-level, and this app's established pattern is adapter-level unit tests plus live browser verification for component behavior, not a component test suite).
- `pnpm --filter web build` — succeeded (157 modules, 513.38 kB JS / 14.33 kB CSS pre-gzip).

## Known limitations

Same two from the previous checkpoint's handoff, unchanged: CR-018's two gaps (no way to view upload content — though Codex appears to be actively working on this now; an invalid attachment reference 500s instead of a proper 4xx), and the `.env` duplicate `AUTH_MODE` line.

## What the other agent (Codex) should look at next

Nothing new blocking from this pass. Once the in-progress `GET /uploads/:id` work is committed, it'd be worth a follow-up checkpoint to wire it frontend-side (rendering actual photo thumbnails/links on `AdminIssueQuote` instead of just a count) — flagging for when that lands, not requesting it now since it isn't committed yet.
