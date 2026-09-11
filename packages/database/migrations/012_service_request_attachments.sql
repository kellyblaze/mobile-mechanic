CREATE TABLE IF NOT EXISTS service_request_attachments (
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES upload_references(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_request_id, upload_id)
);
CREATE INDEX IF NOT EXISTS service_request_attachments_upload_idx ON service_request_attachments(upload_id);
