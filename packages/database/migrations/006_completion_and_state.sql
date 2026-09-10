CREATE TABLE IF NOT EXISTS completion_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES jobs(id), mechanic_id uuid NOT NULL REFERENCES users(id), summary text NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id));
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id, created_at DESC);
