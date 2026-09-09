# Integration status

| Feature | Backend | Frontend | Real integration | Evidence / blocker |
|---|---|---|---|---|
| Health/session | implemented (development auth adapter) | dev-role switcher wired, labeled "not a real login" | integrated (dev headers only) | no managed auth credentials; sign-in/recovery UI not built |
| Service catalog | implemented via in-memory adapter | implemented (Home) | integrated | verified via browser against real API; business catalog/prices not configured |
| Vehicle create/list | implemented | implemented (My Garage: list + create form) | integrated | verified via browser: real GET + POST, 422 field-error display confirmed by contract; POST goes through CR-001 stopgap in apiAdapter.ts, not the generated client |
| Quote acceptance | implemented with version conflict checks | implemented (Repair Room: approve button) | integrated | verified via browser: real POST with Idempotency-Key header, and a real 409 STALE_VERSION correctly rendered on re-click |
| Repair Room read | implemented for authorized fixture job | implemented (status, version, allowedActions) | integrated | verified via browser against job-1; messages/findings/transitions sections render an honest "not yet published" note, not fake data |
| Booking/availability | contract planned only | not started | mocked/pending | scheduling transactions and business policy pending |
| Uploads/messages/payments | contract planned only | not started | mocked/pending | provider credentials and adapters pending |
| Admin/mechanic workflows | schema/roles planned | not started | mocked/pending | vertical slice remains; dev role switcher exists but no mechanic/admin screens built yet |
| My Garage / Vehicle Passport | vehicle fields via existing `GET /vehicles`; `/vehicles/{id}/history` contract planned only | implemented (`/vehicles/:id`: vehicle info from cached list) / pending (history section) | integrated (vehicle info) / mocked-honest-pending (history) | verified via browser: My Garage card links to real per-vehicle page; history section shows an explicit not-yet-available note, not fake records. CR-003 filed for the history endpoint. |
| Get My Car Right (phased plans) | contract planned only | not started | mocked/pending | out of scope until scheduling/change-order contract exists |

Business inputs still required: real business identity, service area/timezone, hours/staff, pricing/taxes/fees, deposit/cancellation rules, payment account, notification preferences, warranty terms, storage/auth providers, and bodywork partner details.
