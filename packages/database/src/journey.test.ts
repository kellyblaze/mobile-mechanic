import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';
import { createQuoteJobRepository } from './repositories.js';

describe('seeded customer-to-mechanic journey', () => {
  it('creates, accepts, completes, and invoices a job', async () => {
    const db = createDatabase(); if (!db) return;
    const ids = (await db.query<{ customer: string; mechanic: string; vehicle: string }>(`SELECT (SELECT id FROM users WHERE email='customer-demo@local.test') customer, (SELECT id FROM users WHERE email='mechanic-demo@local.test') mechanic, (SELECT id FROM vehicles WHERE customer_id=(SELECT id FROM users WHERE email='customer-demo@local.test') LIMIT 1) vehicle`))[0];
    const request = (await db.query<{ id: string }>("INSERT INTO service_requests (customer_id, vehicle_id, category, symptoms, delivery_mode) VALUES ($1,$2,'diagnostic','{}','mobile') RETURNING id", [ids.customer, ids.vehicle]))[0];
    const repo = createQuoteJobRepository(db); const quote = await repo.createQuote({ requestId: request.id, customerId: ids.customer, currency: 'USD', lines: [{ description: 'Diagnostic', amountMinor: 12900 }] });
    const accepted = await repo.acceptQuote(quote.id, ids.customer, 1); expect(accepted.kind).toBe('accepted');
    const appointment = (await db.query<{ id: string }>("INSERT INTO appointments (quote_id, customer_id, mechanic_id, starts_at, ends_at, timezone, status) VALUES ($1,$2,$3,now()+interval '24 hours',now()+interval '25 hours','America/New_York','scheduled') RETURNING id", [quote.id, ids.customer, ids.mechanic]))[0];
    const job = (await db.query<{ id: string }>("INSERT INTO jobs (appointment_id, customer_id, mechanic_id, status) VALUES ($1,$2,$3,'scheduled') RETURNING id", [appointment.id, ids.customer, ids.mechanic]))[0];
    const transitioned = await repo.transitionJob(job.id, ids.mechanic, 'mechanic', 1, 'repairing'); expect(transitioned?.status).toBe('repairing');
    const completed = await repo.completeJob(job.id, ids.mechanic, 'Diagnostic completed; repair documented.'); expect(completed?.job.status).toBe('completed');
    const invoice = (await db.query<{ id: string }>("INSERT INTO invoices (job_id, customer_id, currency, total_minor, status) VALUES ($1,$2,'USD',12900,'open') RETURNING id", [job.id, ids.customer]))[0];
    expect((await db.query('SELECT 1 FROM invoices WHERE id=$1 AND customer_id=$2', [invoice.id, ids.customer])).length).toBe(1);
    await db.withTransaction(async (client) => { await client.query('DELETE FROM invoices WHERE id=$1', [invoice.id]); await client.query('DELETE FROM completion_reports WHERE job_id=$1', [job.id]); await client.query('DELETE FROM jobs WHERE id=$1', [job.id]); await client.query('DELETE FROM appointments WHERE id=$1', [appointment.id]); await client.query('DELETE FROM approvals WHERE quote_id=$1', [quote.id]); await client.query('DELETE FROM quote_lines WHERE quote_id=$1', [quote.id]); await client.query('DELETE FROM quotes WHERE id=$1', [quote.id]); await client.query('DELETE FROM service_requests WHERE id=$1', [request.id]); });
    await db.close();
  });
});
