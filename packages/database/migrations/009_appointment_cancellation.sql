BEGIN;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason text;
CREATE INDEX IF NOT EXISTS idx_appointments_cancellation ON appointments(cancelled_at) WHERE cancelled_at IS NOT NULL;

COMMIT;
