CREATE UNIQUE INDEX IF NOT EXISTS booking_holds_customer_idempotency ON booking_holds(customer_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_customer_idempotency ON payment_attempts(customer_id, idempotency_key);
