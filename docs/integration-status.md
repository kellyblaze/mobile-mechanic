# Integration status

| Feature | Backend | Frontend | Real integration | Evidence / blocker |
|---|---|---|---|---|
| Health/session | Supabase JWT validation plus explicit development adapter | dev-role switcher remains for local development | managed integration verified with disposable Supabase users | frontend sign-in/session UI still required |
| Service catalog | implemented via in-memory adapter | implemented (Home) | integrated | verified via browser against real API; business catalog/prices not configured |
| Vehicle create/list | PostgreSQL repository when configured; fixture fallback only without DB/mock | implemented (My Garage: list + create form) | managed JWT and PostgreSQL paths verified | business-specific vehicle policy remains minimal |
| Service request submission | implemented | integrated (Tap Your Trouble submit) | integrated against development adapter | durable repository and production routing pending |
| Upload initiation metadata | implemented via safe local adapter | not wired | mocked/pending | private signed object storage pending |
| Quote acceptance | implemented with version conflict checks | implemented (Repair Room: real `GET /quotes/{id}` via `job.quoteId`, no more hardcoded quote-1/version 1 — CR-002 frontend cleanup done) | integrated | verified via browser + curl against real Postgres-backed API |
| Repair Room read | implemented, real Postgres persistence | implemented (status, version, allowedActions) | integrated | **Found live**: real `GET /jobs/{id}` response omits `allowedActions` entirely (not just empty) for the seeded job — `Job.allowedActions` changed to optional in `apiAdapter.ts` and `RepairRoom.tsx` defends with `?? []`; confirmed no crash against real data after the fix. Also found live: the old `job-1` fixture id 403s under real persistence — nav link and route default updated to the real seeded UUID (`packages/database/src/seed.ts`). |
| Repair Room messages/findings | durable PostgreSQL read/write routes | integrated (read thread, send message, findings empty/list states) | managed role matrix and durable DB path verified | realtime delivery and attachment storage pending |
| Tap Your Trouble intake | implemented (`POST /service-requests`, upload metadata) | integrated (`POST /service-requests`) | development adapter | real object storage upload still pending |
| Booking/availability | contract planned only | not started | mocked/pending | scheduling transactions and business policy pending |
| Uploads/payments | Stripe payment intent/refund routes and signed webhook reconciliation; uploads remain metadata-only | not started | Stripe CLI test event delivered with HTTP 200 | no live charge, private storage, or production webhook endpoint |
| Admin/mechanic workflows | quote issuance, job operations, admin/mechanic lists, transitions, completion, findings | not started | managed JWT role matrix verified | frontend screens and richer dispatch policy remain |
| My Garage / Vehicle Passport | vehicle fields plus durable `/vehicles/{id}/history` | vehicle info and history consumer wired with real loading/error/empty/list states | verified | Fixed the history route to use the PostgreSQL vehicle ownership path for UUID-backed vehicles; customer flow returns history and mechanic access remains 403. |
| Get My Car Right (phased plans) | contract planned only | not started | mocked/pending | out of scope until scheduling/change-order contract exists |

Business inputs still required: real business identity, service area/timezone, hours/staff, pricing/taxes/fees, deposit/cancellation rules, payment account, notification preferences, warranty terms, storage/auth providers, and bodywork partner details.

Verification scripts: `pnpm test:managed-auth` runs a disposable Supabase customer journey against a managed API; `pnpm test:managed-matrix` creates disposable customer/mechanic/admin users and checks role permissions. Start the API with `AUTH_MODE=managed` and run Stripe CLI with `stripe listen --forward-to http://127.0.0.1:3006/api/v1/webhooks/stripe` for signed test delivery.

**Local dev note (not fixed, flagging only — `.env` is off-limits to modify):** the repository's local `.env` currently has `AUTH_MODE=managed` and `DATABASE_REQUIRED=true`, which returns `401 UNAUTHENTICATED` for the plain `X-Dev-User-Id`/`X-Dev-Role` headers `docs/frontend-handoff.md` documents as the local frontend dev workflow. Verified locally with a process-level override (`AUTH_MODE=development DATABASE_REQUIRED=false pnpm dev`, not an `.env` edit) — everything below was checked against that. Whoever runs frontend dev locally next will hit the same 401 unless `.env` is switched back or the same override is used.
