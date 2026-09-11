import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';
import { createBookingRepository } from './repositories.js';

describe('PostgreSQL appointment rescheduling', () => {
  it('reassigns the job and enforces hold, version, cutoff, and admin rules', async () => {
    const db = createDatabase();
    if (!db) return;
    const ids = (await db.query<{ customer: string; mechanic: string; admin: string }>(`SELECT (SELECT id FROM users WHERE email='customer-demo@local.test') customer, (SELECT id FROM users WHERE email='mechanic-demo@local.test') mechanic, (SELECT id FROM users WHERE email='admin-demo@local.test') admin`))[0];
    const repo = createBookingRepository(db);
    const created: string[] = [];
    let jobId: string | undefined;
    try {
      const old = (await db.query<{ id: string }>("INSERT INTO appointments (customer_id, mechanic_id, starts_at, ends_at, timezone, status, version) VALUES ($1,$2,now()+interval '70 days',now()+interval '70 days 1 hour','America/New_York','scheduled',1) RETURNING id", [ids.customer, ids.mechanic]))[0].id; created.push(old);
      const job = (await db.query<{ id: string }>("INSERT INTO jobs (appointment_id, customer_id, mechanic_id, status, version) VALUES ($1,$2,$3,'scheduled',1) RETURNING id", [old, ids.customer, ids.mechanic]))[0].id;
      jobId = job;
      const hold = (await db.query<{ id: string }>("INSERT INTO booking_holds (customer_id, mechanic_id, starts_at, ends_at, expires_at, status, idempotency_key) VALUES ($1,$2,now()+interval '71 days',now()+interval '71 days 1 hour',now()+interval '70 days 23 hours','active',$3) RETURNING id", [ids.customer, ids.mechanic, `reschedule-${Date.now()}`]))[0].id;
      const moved = await repo.rescheduleAppointment({ appointmentId: old, holdId: hold, actorId: ids.customer, role: 'customer', expectedVersion: 1, reason: 'Customer requested a later slot' });
      expect(moved.kind).toBe('rescheduled');
      if (moved.kind === 'rescheduled') {
        expect(moved.appointment.rescheduledFromId).toBe(old);
        expect((await db.query<{ appointmentId: string }>('SELECT appointment_id AS "appointmentId" FROM jobs WHERE id=$1', [job]))[0].appointmentId).toBe(moved.appointment.id);
      }
      expect((await repo.rescheduleAppointment({ appointmentId: old, holdId: hold, actorId: ids.customer, role: 'customer', expectedVersion: 1 })).kind).toBe('not_found');

      const staleOld = (await db.query<{ id: string }>("INSERT INTO appointments (customer_id, mechanic_id, starts_at, ends_at, timezone, status, version) VALUES ($1,$2,now()+interval '80 days',now()+interval '80 days 1 hour','America/New_York','scheduled',2) RETURNING id", [ids.customer, ids.mechanic]))[0].id; created.push(staleOld);
      const staleHold = (await db.query<{ id: string }>("INSERT INTO booking_holds (customer_id, mechanic_id, starts_at, ends_at, expires_at, status, idempotency_key) VALUES ($1,$2,now()+interval '81 days',now()+interval '81 days 1 hour',now()+interval '80 days 23 hours','active',$3) RETURNING id", [ids.customer, ids.mechanic, `reschedule-stale-${Date.now()}`]))[0].id;
      expect((await repo.rescheduleAppointment({ appointmentId: staleOld, holdId: staleHold, actorId: ids.customer, role: 'customer', expectedVersion: 1 })).kind).toBe('stale');
      expect((await repo.rescheduleAppointment({ appointmentId: staleOld, holdId: staleHold, actorId: ids.customer, role: 'customer', expectedVersion: 2 })).kind).toBe('rescheduled');

      const cutoffOld = (await db.query<{ id: string }>("INSERT INTO appointments (customer_id, mechanic_id, starts_at, ends_at, timezone, status, version) VALUES ($1,$2,now()+interval '1 hour',now()+interval '2 hours','America/New_York','scheduled',1) RETURNING id", [ids.customer, ids.mechanic]))[0].id; created.push(cutoffOld);
      const cutoffHold = (await db.query<{ id: string }>("INSERT INTO booking_holds (customer_id, mechanic_id, starts_at, ends_at, expires_at, status, idempotency_key) VALUES ($1,$2,now()+interval '90 days',now()+interval '90 days 1 hour',now()+interval '89 days 23 hours','active',$3) RETURNING id", [ids.customer, ids.mechanic, `reschedule-cutoff-${Date.now()}`]))[0].id;
      expect((await repo.rescheduleAppointment({ appointmentId: cutoffOld, holdId: cutoffHold, actorId: ids.customer, role: 'customer', expectedVersion: 1 })).kind).toBe('cutoff');
      expect((await repo.rescheduleAppointment({ appointmentId: cutoffOld, holdId: cutoffHold, actorId: ids.admin, role: 'admin', expectedVersion: 1 })).kind).toBe('rescheduled');
      expect((await repo.rescheduleAppointment({ appointmentId: staleOld, holdId: cutoffHold, actorId: ids.customer, role: 'customer', expectedVersion: 2 })).kind).toBe('not_found');
    } finally {
      await db.withTransaction(async (client) => {
        if (jobId) await client.query('DELETE FROM jobs WHERE id = $1', [jobId]);
        for (const id of created) {
          await client.query('UPDATE appointments SET rescheduled_to_id = NULL WHERE id = $1', [id]);
          await client.query('DELETE FROM appointments WHERE rescheduled_from_id = $1', [id]);
          await client.query('DELETE FROM appointments WHERE id = $1', [id]);
        }
        await client.query("UPDATE appointments SET hold_id = NULL WHERE hold_id IN (SELECT id FROM booking_holds WHERE idempotency_key LIKE 'reschedule-%')");
        await client.query("DELETE FROM booking_holds WHERE idempotency_key LIKE 'reschedule-%'");
        await client.query("DELETE FROM audit_events WHERE action = 'appointment.rescheduled'");
      });
      await db.close();
    }
  });
});
