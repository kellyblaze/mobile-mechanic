# Handoff: real payments and booking/availability, four new change requests

Feature and owner: Stripe payment collection for invoices, and booking/availability — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `2c6c918e2993b6242c9731581e3c9e73ec8cb791` (working tree clean, pushed to `origin`).
Contract version: still `1.4.0` (`packages/contracts/openapi.yaml`) — nothing here required a further contract change; all four gaps below are filed as CRs instead.

## What now works

**Payments**: `PayInvoice` (`/invoices/:id/pay`) creates a real Stripe PaymentIntent via `POST /payments` and confirms it with `@stripe/react-stripe-js`'s `PaymentElement`. A "Pay" link appears on any Repair Room invoice with `status: "open"`.

**Booking/availability**: `Booking` (`/book`) checks a real 1-hour window against the one seeded mechanic via `GET /availability`, then creates a real hold via `POST /booking-holds` if free. Verified live end to end through the actual screen, not just curl.

Both request/response shapes came from reading `apps/api/src/server.ts` directly, since neither operation family has a response schema in `openapi.yaml`.

## Four change requests filed this checkpoint

### CR-009: `POST /payments` has no way to link to an invoice, and nothing marks one paid
`payment_attempts` already has an unused `invoice_id` column. Nothing sets it, and the Stripe webhook handler never touches `invoices.status`. A customer can pay and the invoice stays `"open"` forever. `PayInvoice` discloses this after a successful payment rather than claiming the invoice is now paid.

### CR-010: no endpoint creates an invoice at all
Grepped every route — the only place an invoice is ever created is a direct SQL insert in `packages/database/src/journey.test.ts`. `GET /invoices` has returned `{"data":[]}` for this customer the entire session. This blocked live end-to-end verification of the payment-confirmation step itself (see Known limitations below).

### CR-011: no endpoint lists mechanics
`GET /availability` and `POST /booking-holds` both require a raw `mechanicId` UUID, but nothing surfaces which UUIDs are valid. `Booking.tsx` hardcodes the one seeded mechanic's id, found only by calling `GET /session` with the `mechanic-demo` dev header — not something a real customer could ever do.

### CR-012: a booking hold never becomes an appointment, and `GET /availability` doesn't even see holds
The more serious one. Nothing converts a `booking_holds` row into an `appointments` row, despite a `hold_id` column existing specifically for that. Confirmed live: created two holds, neither produced anything visible anywhere in the app. Worse — found live through the actual `Booking` screen, not just curl: `GET /availability` only queries `appointments`, never `booking_holds`, so a slot with a real active hold on it still reports `available: true` when re-checked. Checked a window, held it, re-checked the identical window — still available. Two customers could hold the same slot right now with nothing catching it. Also flagged (not filed separately): the overlap-prevention exclusion constraint in `packages/database/migrations/005_booking_hold_overlap.sql` didn't block a real overlapping hold in curl testing either — noted as possibly an unapplied migration rather than assumed broken, since that's an environment question the frontend can't resolve.

Full detail for all four in `docs/change-requests/CR-009.md` through `CR-012.md`.

## Files and endpoint operations changed

Everything under `apps/web/` across two commits (`7c1d431` payments, `2c6c918` booking — see `git log --oneline dba7866..2c6c918` for the full range including the CR-008 stale-notice cleanup in between). New docs: `CR-009.md` through `CR-012.md`, this file. `docs/integration-status.md` updated throughout, including correcting a stale "Booking/availability: contract planned only" line found this checkpoint — both routes are real and implemented. New frontend-only dependencies: `@stripe/stripe-js`, `@stripe/react-stripe-js` (confirmed with the user first, same as the earlier Supabase install).
No backend-owned files touched.
Endpoint operations exercised, all against the real dev API: `createPayment` (real PaymentIntent returned), `checkAvailability` and `createBookingHold` (both exercised live through the actual UI, not just curl).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — restart it after pulling new backend commits; tsx has no watch mode here
pnpm --filter web dev       # Vite on :5173, or use the .claude/launch.json "web" config via preview_start
```

Booking, as customer-demo: My Garage → Book → pick a future date/time → Check availability → Hold this slot → note it's still "available" on re-check (CR-012). Payments: needs `apps/web/.env` populated with `VITE_STRIPE_PUBLISHABLE_KEY` from `.env.example` (gitignored, not in this diff) — the "Pay" link only appears on an invoice, and none exist in dev right now (CR-010).

## Tests run and actual results (just re-run, fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, 21 tests passed (7 new across both commits: `createPayment`, `refundPayment`, `checkAvailability`, `createBookingHold`, plus the ones already covering `listAdminServiceRequests`/`provisionMembership`).
- `pnpm --filter web build` — succeeded (151 modules, 492.47 kB JS / 14.00 kB CSS pre-gzip; bundle grew from ~475 kB after adding the Stripe SDKs — expected, flagging in case size matters).
- Booking was verified fully live end to end through the actual UI. Payments was verified as far as it could be: `POST /payments` confirmed live via curl (real PaymentIntent), Stripe.js's real script tag loads in-browser and `window.Stripe` resolves to a real function — but the PaymentElement-mount-and-confirm step itself was never clicked through, because no invoice exists in dev to reach it from (CR-010). Documented as an open verification gap in `docs/integration-status.md`, not claimed as done.

## Known limitations / missing credentials

- CR-009 through CR-012, above — all open, none actioned.
- Real object storage for uploads is still a stub (unrelated to this checkpoint — see the CR-006/007/008 handoff).
- No sign-up screen and no password-reset flow (CR-007's resolved policy doesn't need the former).

## What the other agent (Codex) must do next

Rough priority order, in my view — feel free to disagree:

1. **CR-012** — the booking-availability-doesn't-see-holds gap is the most consequential; a small fix (make `GET /availability` also check `booking_holds`) would meaningfully de-risk double-booking even before the full hold→appointment conversion exists.
2. **CR-010** — unblocks fully verifying the payment flow live, and is presumably needed for real billing regardless.
3. **CR-011** and **CR-009** — both small and self-contained.

No backend defects found in `POST /payments`, `GET /availability`, or `POST /booking-holds` themselves — all three behaved exactly as their own code describes when exercised live, repeatedly.
