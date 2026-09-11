BEGIN;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_to_id uuid REFERENCES appointments(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid REFERENCES appointments(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_by uuid REFERENCES users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduling_reason text;
CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled_to ON appointments(rescheduled_to_id) WHERE rescheduled_to_id IS NOT NULL;

COMMIT;
