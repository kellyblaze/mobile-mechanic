-- Supabase client access is denied by default. The API uses the database owner
-- connection and applies authorization in its repositories/routes; these policies
-- protect direct Supabase client access and are bypassed by the service role.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY memberships_self ON memberships FOR SELECT USING (user_id = auth.uid());
CREATE POLICY vehicles_customer ON vehicles USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY requests_customer ON service_requests USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY quotes_customer ON quotes FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY quote_lines_customer ON quote_lines FOR SELECT USING (EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id AND q.customer_id = auth.uid()));
CREATE POLICY appointments_participant ON appointments FOR SELECT USING (customer_id = auth.uid() OR mechanic_id = auth.uid());
CREATE POLICY jobs_participant ON jobs FOR SELECT USING (customer_id = auth.uid() OR mechanic_id = auth.uid());
CREATE POLICY holds_customer ON booking_holds USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY uploads_owner ON upload_references USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY messages_participant ON job_messages USING (EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND (j.customer_id = auth.uid() OR j.mechanic_id = auth.uid()))) WITH CHECK (sender_id = auth.uid());
CREATE POLICY findings_participant ON inspection_findings FOR SELECT USING (EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND (j.customer_id = auth.uid() OR j.mechanic_id = auth.uid())));
CREATE POLICY findings_mechanic ON inspection_findings FOR INSERT WITH CHECK (mechanic_id = auth.uid());
CREATE POLICY invoices_customer ON invoices FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY invoice_lines_customer ON invoice_lines FOR SELECT USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.customer_id = auth.uid()));
CREATE POLICY payments_customer ON payment_attempts FOR SELECT USING (customer_id = auth.uid());
