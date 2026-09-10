ALTER TABLE booking_holds ADD CONSTRAINT booking_holds_no_overlap EXCLUDE USING gist (mechanic_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'active');
