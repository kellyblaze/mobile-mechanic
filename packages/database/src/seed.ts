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
  await client.query("INSERT INTO vehicles (customer_id, year, make, model, mileage) SELECT $1, 2020, 'Toyota', 'Camry', 42000 WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE customer_id = $1)", [customer]);
});
await db.close();
console.log('Safe development seed applied. Demo identity mapping remains customer-demo, mechanic-demo, and admin-demo for the development adapter.');
