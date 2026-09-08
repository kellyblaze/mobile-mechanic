# Integration status

| Feature | Backend | Frontend | Real integration | Evidence / blocker |
|---|---|---|---|---|
| Health/session | implemented (development auth adapter) | not started | mocked/dev only | no managed auth credentials |
| Service catalog | implemented via in-memory adapter | not started | development adapter | business catalog/prices not configured |
| Vehicle create/list | implemented | not started | development adapter | PostgreSQL repository pending |
| Quote acceptance | implemented with version conflict checks | not started | development adapter | durable idempotency/payment pending |
| Repair Room read | implemented for authorized fixture job | not started | fixture-backed | messages/findings/transitions pending |
| Booking/availability | contract planned only | not started | mocked/pending | scheduling transactions and business policy pending |
| Uploads/messages/payments | contract planned only | not started | mocked/pending | provider credentials and adapters pending |
| Admin/mechanic workflows | schema/roles planned | not started | mocked/pending | vertical slice remains |

Business inputs still required: real business identity, service area/timezone, hours/staff, pricing/taxes/fees, deposit/cancellation rules, payment account, notification preferences, warranty terms, storage/auth providers, and bodywork partner details.
