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
    async listFindings(jobId: string) { return db.query('SELECT id, job_id AS "jobId", mechanic_id AS "mechanicId", category, note, attachment_id AS "attachmentId", created_at AS "createdAt" FROM inspection_findings WHERE job_id = $1 ORDER BY created_at', [jobId]); }
  };
}

export function createInvoiceRepository(db: Database) {
  return { async listForCustomer(customerId: string) { return db.query('SELECT id, job_id AS "jobId", customer_id AS "customerId", currency, total_minor AS "totalMinor", status, due_at AS "dueAt", created_at AS "createdAt" FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]); } };
}
