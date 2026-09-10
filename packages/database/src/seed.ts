import 'dotenv/config';
import { createDatabase } from './client.js';

const db = createDatabase();
if (!db) { console.log('DATABASE_URL is not set; seed skipped.'); process.exit(0); }
await db.withTransaction(async (client) => {
  const business = await client.query<{ id: string }>(`INSERT INTO businesses (name, timezone) VALUES ('Travel Automotive', 'America/New_York') ON CONFLICT DO NOTHING RETURNING id`);
  const businessId = business.rows[0]?.id ?? (await client.query<{ id: string }>('SELECT id FROM businesses ORDER BY created_at LIMIT 1')).rows[0].id;
  for (const [email, role] of [['customer-demo@local.test', 'customer'], ['mechanic-demo@local.test', 'mechanic'], ['admin-demo@local.test', 'admin']] as const) {
    const user = await client.query<{ id: string }>('INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id', [email]);
    await client.query('INSERT INTO memberships (user_id, business_id, role) VALUES ($1,$2,$3) ON CONFLICT (user_id,business_id) DO UPDATE SET role = EXCLUDED.role', [user.rows[0].id, businessId, role]);
  }
  const customer = (await client.query<{ id: string }>("SELECT id FROM users WHERE email = 'customer-demo@local.test'")).rows[0].id;
  const vehicle = (await client.query<{ id: string }>("INSERT INTO vehicles (customer_id, year, make, model, mileage) SELECT $1, 2020, 'Toyota', 'Camry', 42000 WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE customer_id = $1) RETURNING id", [customer])).rows[0] ?? (await client.query<{ id: string }>('SELECT id FROM vehicles WHERE customer_id=$1 ORDER BY created_at LIMIT 1', [customer])).rows[0];
  const mechanic = (await client.query<{ id: string }>("SELECT id FROM users WHERE email = 'mechanic-demo@local.test'")).rows[0].id;
  await client.query("INSERT INTO service_requests (id, customer_id, vehicle_id, category, symptoms, delivery_mode) VALUES ('11111111-1111-4111-8111-111111111111',$1,$2,'diagnostic','{}','mobile') ON CONFLICT (id) DO NOTHING", [customer, vehicle.id]);
  await client.query("INSERT INTO quotes (id, request_id, customer_id, status, currency, total_minor) VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',$1,'issued','USD',12900) ON CONFLICT (id) DO NOTHING", [customer]);
  await client.query("INSERT INTO appointments (id, quote_id, customer_id, mechanic_id, starts_at, ends_at, timezone, status) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222',$1,$2,now()+interval '7 days',now()+interval '7 days 1 hour','America/New_York','scheduled') ON CONFLICT (id) DO NOTHING", [customer, mechanic]);
  await client.query("INSERT INTO jobs (id, appointment_id, customer_id, mechanic_id, status) VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',$1,$2,'scheduled') ON CONFLICT (id) DO NOTHING", [customer, mechanic]);
});
await db.close();
console.log('Safe development seed applied. Demo identity mapping remains customer-demo, mechanic-demo, and admin-demo for the development adapter.');
