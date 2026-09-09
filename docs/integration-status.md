# Integration status

| Feature | Backend | Frontend | Real integration | Evidence / blocker |
|---|---|---|---|---|
| Health/session | implemented (development auth adapter) | dev-role switcher wired, labeled "not a real login" | integrated (dev headers only) | no managed auth credentials; sign-in/recovery UI not built |
| Service catalog | implemented via in-memory adapter | implemented (Home) | integrated | verified via browser against real API; business catalog/prices not configured |
| Vehicle create/list | implemented | implemented (My Garage: list + create form) | integrated | verified via browser: real GET + POST, 422 field-error display confirmed by contract |
| Service request submission | implemented | integrated (Tap Your Trouble submit) | integrated against development adapter | durable repository and production routing pending |
| Upload initiation metadata | implemented via safe local adapter | not wired | mocked/pending | private signed object storage pending |
| Quote acceptance | implemented with version conflict checks | implemented (Repair Room: approve button) | integrated | verified via browser: real POST with Idempotency-Key header, and a real 409 STALE_VERSION correctly rendered on re-click |
| Repair Room read | implemented for authorized fixture job | implemented (status, version, allowedActions) | integrated | verified via browser against job-1 |
| Repair Room messages/findings | implemented | integrated (read thread, send message, findings empty/list states) | development adapter | durable repository/realtime pending |
| Tap Your Trouble intake | implemented (`POST /service-requests`, upload metadata) | integrated (`POST /service-requests`) | development adapter | real object storage upload still pending |
| Booking/availability | contract planned only | not started | mocked/pending | scheduling transactions and business policy pending |
| Uploads/payments | contract planned only (uploads also tracked under Tap Your Trouble above) | not started | mocked/pending | provider credentials and adapters pending |
| Admin/mechanic workflows | schema/roles planned | not started | mocked/pending | vertical slice remains; dev role switcher exists but no mechanic/admin screens built yet |
| My Garage / Vehicle Passport | vehicle fields plus `/vehicles/{id}/history` implemented | vehicle info integrated; history consumer pending | development adapter | completed history records require completed-job persistence |
| Get My Car Right (phased plans) | contract planned only | not started | mocked/pending | out of scope until scheduling/change-order contract exists |

Business inputs still required: real business identity, service area/timezone, hours/staff, pricing/taxes/fees, deposit/cancellation rules, payment account, notification preferences, warranty terms, storage/auth providers, and bodywork partner details.
