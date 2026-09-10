import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';
import { createBookingRepository } from './repositories.js';

describe('PostgreSQL booking concurrency', () => {
  it('allows only one overlapping active hold', async () => {
    const db = createDatabase();
    if (!db) return;
    const users = await db.query<{ customer: string; mechanic: string }>(`SELECT (SELECT id FROM users WHERE email = 'customer-demo@local.test') AS customer, (SELECT id FROM users WHERE email = 'mechanic-demo@local.test') AS mechanic`);
    const { customer, mechanic } = users[0];
    const repo = createBookingRepository(db);
    const start = new Date(Date.now() + 60 * 60 * 1000); const end = new Date(start.getTime() + 30 * 60 * 1000); const expires = new Date(start.getTime() - 60 * 1000);
    const results = await Promise.allSettled([1, 2].map((n) => repo.createHold({ customerId: customer, mechanicId: mechanic, startsAt: start, endsAt: end, expiresAt: expires, idempotencyKey: `concurrency-${Date.now()}-${n}` })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected' && (r.reason as { code?: string }).code === '23P01')).toHaveLength(1);
    await db.query("DELETE FROM booking_holds WHERE idempotency_key LIKE 'concurrency-%'"); await db.close();
  });
});
