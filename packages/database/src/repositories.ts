import type { Database } from './client.js';

export function createVehicleRepository(db: Database) {
  return {
    async listForCustomer(customerId: string) { return db.query('SELECT id, customer_id AS "customerId", year, make, model, mileage, vin FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]); },
    async create(customerId: string, input: { year: number; make: string; model: string; mileage?: number; vin?: string }) { const rows = await db.query('INSERT INTO vehicles (customer_id, year, make, model, mileage, mileage_recorded_at, vin) VALUES ($1,$2,$3,$4,$5::integer,CASE WHEN $5::integer IS NULL THEN NULL ELSE now() END,$6) RETURNING id, customer_id AS "customerId", year, make, model, mileage, vin', [customerId, input.year, input.make, input.model, input.mileage ?? null, input.vin ?? null]); return rows[0]; }
  };
}

export function createServiceRequestRepository(db: Database) {
  return { async create(customerId: string, input: { vehicleId: string; category: string; symptoms: string[]; notes?: string }) { const rows = await db.query('INSERT INTO service_requests (customer_id, vehicle_id, category, symptoms, delivery_mode) SELECT $1, v.id, $2, $3, CASE WHEN $2 = \'bodywork\' THEN \'shop\' ELSE \'mobile\' END FROM vehicles v WHERE v.id = $4 AND v.customer_id = $1 RETURNING id, customer_id AS "customerId", vehicle_id AS "vehicleId", category, symptoms, status, created_at', [customerId, input.category, JSON.stringify({ selected: input.symptoms, notes: input.notes ?? null }), input.vehicleId]); return rows[0] ?? null; } };
}

export function createBookingRepository(db: Database) {
  return {
    async createHold(input: { customerId: string; mechanicId: string; startsAt: Date; endsAt: Date; expiresAt: Date; idempotencyKey: string }) {
      return db.withTransaction(async (client) => {
        const existing = await client.query('SELECT id, status, expires_at AS "expiresAt" FROM booking_holds WHERE customer_id = $1 AND idempotency_key = $2', [input.customerId, input.idempotencyKey]);
        if (existing.rows[0]) return existing.rows[0];
        await client.query("UPDATE booking_holds SET status = 'expired' WHERE status = 'active' AND expires_at <= now()");
        const rows = await client.query('INSERT INTO booking_holds (customer_id, mechanic_id, starts_at, ends_at, expires_at, status, idempotency_key) VALUES ($1,$2,$3,$4,$5,\'active\',$6) RETURNING id, customer_id AS "customerId", mechanic_id AS "mechanicId", starts_at AS "startsAt", ends_at AS "endsAt", expires_at AS "expiresAt", status', [input.customerId, input.mechanicId, input.startsAt, input.endsAt, input.expiresAt, input.idempotencyKey]);
        return rows.rows[0];
      });
    }
  };
}

export function createPaymentRepository(db: Database) {
  return { async createAttempt(input: { customerId: string; amountMinor: number; currency: string; idempotencyKey: string }) { const rows = await db.query('INSERT INTO payment_attempts (customer_id, provider, amount_minor, currency, status, idempotency_key) VALUES ($1,\'stripe\',$2,$3,\'created\',$4) ON CONFLICT DO NOTHING RETURNING id, status, amount_minor AS "amountMinor", currency, idempotency_key AS "idempotencyKey"', [input.customerId, input.amountMinor, input.currency, input.idempotencyKey]); return rows[0]; } };
}

export function createRepairRoomRepository(db: Database) {
  return {
    async listMessages(jobId: string) { return db.query('SELECT id, job_id AS "jobId", sender_id AS "senderId", body, created_at AS "createdAt" FROM job_messages WHERE job_id = $1 ORDER BY created_at', [jobId]); },
    async addMessage(jobId: string, senderId: string, body: string) { const rows = await db.query('INSERT INTO job_messages (job_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, job_id AS "jobId", sender_id AS "senderId", body, created_at AS "createdAt"', [jobId, senderId, body]); return rows[0]; },
    async listFindings(jobId: string) { return db.query('SELECT id, job_id AS "jobId", mechanic_id AS "mechanicId", category, note, attachment_id AS "attachmentId", created_at AS "createdAt" FROM inspection_findings WHERE job_id = $1 ORDER BY created_at', [jobId]); },
    async addFinding(jobId: string, mechanicId: string, input: { category: string; note: string; attachmentId?: string }) { const rows = await db.query('INSERT INTO inspection_findings (job_id, mechanic_id, category, note, attachment_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, job_id AS "jobId", mechanic_id AS "mechanicId", category, note, attachment_id AS "attachmentId", created_at AS "createdAt"', [jobId, mechanicId, input.category, input.note, input.attachmentId ?? null]); return rows[0]; }
  };
}

export function createInvoiceRepository(db: Database) {
  return { async listForCustomer(customerId: string) { return db.query('SELECT id, job_id AS "jobId", customer_id AS "customerId", currency, total_minor AS "totalMinor", status, due_at AS "dueAt", created_at AS "createdAt" FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]); }, async getForCustomer(id: string, customerId: string) { const rows = await db.query('SELECT id, job_id AS "jobId", customer_id AS "customerId", currency, total_minor AS "totalMinor", status, due_at AS "dueAt", created_at AS "createdAt" FROM invoices WHERE id = $1 AND customer_id = $2', [id, customerId]); return rows[0]; } };
}

export function createQuoteJobRepository(db: Database) {
  return {
    async createQuote(input: { requestId: string; customerId: string; currency: string; lines: Array<{ description: string; amountMinor: number; quantity?: number }> }) { return db.withTransaction(async (client) => { const total = input.lines.reduce((sum, line) => sum + line.amountMinor * (line.quantity ?? 1), 0); const quote = await client.query('INSERT INTO quotes (request_id, customer_id, version, status, currency, total_minor) VALUES ($1,$2,1,\'issued\',$3,$4) RETURNING id, request_id AS "requestId", customer_id AS "customerId", version, status, currency, total_minor AS "totalMinor"', [input.requestId, input.customerId, input.currency, total]); for (const line of input.lines) await client.query('INSERT INTO quote_lines (quote_id, description, amount_minor, quantity) VALUES ($1,$2,$3,$4)', [quote.rows[0].id, line.description, line.amountMinor, line.quantity ?? 1]); return quote.rows[0]; }); },
    async getQuote(id: string, customerId: string) { const rows = await db.query('SELECT q.id, q.request_id AS "requestId", q.customer_id AS "customerId", q.version, q.status, q.currency, q.total_minor AS "totalMinor", COALESCE(json_agg(json_build_object(\'description\',l.description,\'amountMinor\',l.amount_minor,\'quantity\',l.quantity)) FILTER (WHERE l.id IS NOT NULL), \'[]\') AS lines FROM quotes q LEFT JOIN quote_lines l ON l.quote_id = q.id WHERE q.id = $1 AND q.customer_id = $2 GROUP BY q.id', [id, customerId]); return rows[0]; },
    async acceptQuote(id: string, customerId: string, expectedVersion: number) { return db.withTransaction(async (client) => { const current = await client.query('SELECT * FROM quotes WHERE id = $1 AND customer_id = $2 FOR UPDATE', [id, customerId]); if (!current.rows[0]) return { kind: 'not_found' as const }; if (current.rows[0].version !== expectedVersion) return { kind: 'stale' as const, quote: current.rows[0] }; if (current.rows[0].status !== 'issued') return { kind: 'not_acceptable' as const }; const accepted = await client.query('UPDATE quotes SET status = \'accepted\', version = version + 1 WHERE id = $1 RETURNING id, customer_id AS "customerId", version, status, currency, total_minor AS "totalMinor"', [id]); await client.query('INSERT INTO approvals (quote_id, quote_version, actor_id, decision, accepted_total_minor) VALUES ($1,$2,$3,\'accepted\',$4)', [id, expectedVersion, customerId, current.rows[0].total_minor]); return { kind: 'accepted' as const, quote: accepted.rows[0] }; }); },
    async transitionJob(id: string, actorId: string, role: string, expectedVersion: number, status: string) { const rows = await db.query('UPDATE jobs SET status = $1, version = version + 1 WHERE id = $2 AND version = $3 AND (($4 = \'mechanic\' AND mechanic_id = $5) OR $4 = \'admin\') RETURNING id, customer_id AS "customerId", mechanic_id AS "mechanicId", status, version', [status, id, expectedVersion, role, actorId]); return rows[0]; },
    async completeJob(id: string, mechanicId: string, summary: string) { return db.withTransaction(async (client) => { const job = await client.query('UPDATE jobs SET status = \'completed\', version = version + 1 WHERE id = $1 AND mechanic_id = $2 RETURNING id, customer_id AS "customerId", mechanic_id AS "mechanicId", status, version', [id, mechanicId]); if (!job.rows[0]) return null; const report = await client.query('INSERT INTO completion_reports (job_id, mechanic_id, summary) VALUES ($1,$2,$3) ON CONFLICT (job_id) DO UPDATE SET summary = EXCLUDED.summary, completed_at = now() RETURNING id, job_id AS "jobId", summary, completed_at AS "completedAt"', [id, mechanicId, summary]); return { job: job.rows[0], report: report.rows[0] }; }); }
  };
}
