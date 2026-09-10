BEGIN;

ALTER TABLE upload_references ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;
ALTER TABLE upload_references ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_upload_references_owner_status ON upload_references(owner_id, status, created_at DESC);

COMMIT;
