import type { Database } from './client.js';

export function createVehicleRepository(db: Database) {
  return {
    async listForCustomer(customerId: string) { return db.query('SELECT id, customer_id AS "customerId", year, make, model, mileage, vin FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]); },
    async create(customerId: string, input: { year: number; make: string; model: string; mileage?: number; vin?: string }) { const rows = await db.query('INSERT INTO vehicles (customer_id, year, make, model, mileage, mileage_recorded_at, vin) VALUES ($1,$2,$3,$4,$5,CASE WHEN $5 IS NULL THEN NULL ELSE now() END,$6) RETURNING id, customer_id AS "customerId", year, make, model, mileage, vin', [customerId, input.year, input.make, input.model, input.mileage ?? null, input.vin ?? null]); return rows[0]; }
  };
}

export function createServiceRequestRepository(db: Database) {
  return { async create(customerId: string, input: { vehicleId: string; category: string; symptoms: string[]; notes?: string }) { const rows = await db.query('INSERT INTO service_requests (customer_id, vehicle_id, category, symptoms, delivery_mode) SELECT $1, v.id, $2, $3, CASE WHEN $2 = \'bodywork\' THEN \'shop\' ELSE \'mobile\' END FROM vehicles v WHERE v.id = $4 AND v.customer_id = $1 RETURNING id, customer_id AS "customerId", vehicle_id AS "vehicleId", category, symptoms, status, created_at', [customerId, input.category, JSON.stringify({ selected: input.symptoms, notes: input.notes ?? null }), input.vehicleId]); return rows[0] ?? null; } };
}
