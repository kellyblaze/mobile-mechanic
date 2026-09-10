# Integration status

| Feature | Backend | Frontend | Real integration | Evidence / blocker |
|---|---|---|---|---|
| Health/session | Supabase JWT validation plus explicit development adapter | dev-role switcher remains for local development | managed integration verified with disposable Supabase users | frontend sign-in/session UI still required |
| Service catalog | implemented via in-memory adapter | implemented (Home) | integrated | verified via browser against real API; business catalog/prices not configured |
| Vehicle create/list | PostgreSQL repository when configured; fixture fallback only without DB/mock | implemented (My Garage: list + create form) | managed JWT and PostgreSQL paths verified | business-specific vehicle policy remains minimal |
| Service request submission | implemented | integrated (Tap Your Trouble submit) | integrated against development adapter | durable repository and production routing pending |
| Upload initiation metadata | implemented via safe local adapter | not wired | mocked/pending | private signed object storage pending |
| Quote acceptance | implemented with version conflict checks | implemented (Repair Room: approve button) | integrated | verified via browser: real POST with Idempotency-Key header, and a real 409 STALE_VERSION correctly rendered on re-click |
| Repair Room read | implemented for authorized fixture job | implemented (status, version, allowedActions) | integrated | verified via browser against job-1 |
| Repair Room messages/findings | durable PostgreSQL read/write routes | integrated (read thread, send message, findings empty/list states) | managed role matrix and durable DB path verified | realtime delivery and attachment storage pending |
| Tap Your Trouble intake | implemented (`POST /service-requests`, upload metadata) | integrated (`POST /service-requests`) | development adapter | real object storage upload still pending |
| Booking/availability | contract planned only | not started | mocked/pending | scheduling transactions and business policy pending |
| Uploads/payments | Stripe payment intent/refund routes and signed webhook reconciliation; uploads remain metadata-only | not started | Stripe CLI test event delivered with HTTP 200 | no live charge, private storage, or production webhook endpoint |
| Admin/mechanic workflows | quote issuance, job operations, admin/mechanic lists, transitions, completion, findings | not started | managed JWT role matrix verified | frontend screens and richer dispatch policy remain |
| My Garage / Vehicle Passport | vehicle fields plus `/vehicles/{id}/history` implemented | vehicle info integrated; history consumer pending | development adapter | completed history records require completed-job persistence |
| Get My Car Right (phased plans) | contract planned only | not started | mocked/pending | out of scope until scheduling/change-order contract exists |

Business inputs still required: real business identity, service area/timezone, hours/staff, pricing/taxes/fees, deposit/cancellation rules, payment account, notification preferences, warranty terms, storage/auth providers, and bodywork partner details.

Verification scripts: `pnpm test:managed-auth` runs a disposable Supabase customer journey against a managed API; `pnpm test:managed-matrix` creates disposable customer/mechanic/admin users and checks role permissions. Start the API with `AUTH_MODE=managed` and run Stripe CLI with `stripe listen --forward-to http://127.0.0.1:3006/api/v1/webhooks/stripe` for signed test delivery.
