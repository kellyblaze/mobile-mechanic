import 'dotenv/config';
import pg from 'pg';

const baseUrl = process.env.MANAGED_AUTH_BASE_URL ?? 'http://127.0.0.1:3006/api/v1';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DATABASE_URL) throw new Error('Supabase and database configuration is required.');
const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const business = await db.query<{ id: string }>('SELECT id FROM businesses ORDER BY created_at LIMIT 1');
if (!business.rows[0]) throw new Error('No seeded business exists.');

const actors: Array<{ role: 'customer' | 'mechanic' | 'admin'; headers: { authorization: string } }> = [];
for (const role of ['customer', 'mechanic', 'admin'] as const) {
  const email = `codex-matrix-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = `Mm!${Date.now()}-${role}-LocalTest-9`;
  const createdResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!createdResponse.ok) throw new Error(`Could not create ${role} test user: HTTP ${createdResponse.status}.`);
  const created = await createdResponse.json() as { id?: string };
  if (!created.id) throw new Error(`No id returned for ${role} test user.`);
  await db.query('INSERT INTO memberships (user_id,business_id,role) VALUES ($1,$2,$3) ON CONFLICT (user_id,business_id) DO UPDATE SET role=EXCLUDED.role', [created.id, business.rows[0].id, role]);
  const login = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`${role} login failed: HTTP ${login.status}.`);
  const token = (await login.json() as { access_token?: string }).access_token;
  if (!token) throw new Error(`${role} login returned no token.`);
  actors.push({ role, headers: { authorization: `Bearer ${token}` } });
}
await db.end();

const checks: Array<[string, string, string, number]> = [
  ['customer session', 'customer', '/session', 200],
  ['customer vehicles', 'customer', '/vehicles', 200],
  ['customer admin jobs denied', 'customer', '/admin/jobs', 403],
  ['customer mechanic jobs denied', 'customer', '/mechanic/jobs', 403],
  ['mechanic session', 'mechanic', '/session', 200],
  ['mechanic vehicles denied', 'mechanic', '/vehicles', 403],
  ['mechanic jobs', 'mechanic', '/mechanic/jobs', 200],
  ['mechanic admin jobs denied', 'mechanic', '/admin/jobs', 403],
  ['admin session', 'admin', '/session', 200],
  ['admin vehicles denied', 'admin', '/vehicles', 403],
  ['admin jobs', 'admin', '/admin/jobs', 200],
  ['admin mechanic jobs denied', 'admin', '/mechanic/jobs', 403],
];
for (const [name, role, path, expected] of checks) {
  const actor = actors.find(item => item.role === role)!;
  const response = await fetch(`${baseUrl}${path}`, { headers: actor.headers });
  if (response.status !== expected) throw new Error(`${name}: expected ${expected}, got ${response.status}.`);
  console.log(`PASS ${name}: ${response.status}`);
}
const unauthenticated = await fetch(`${baseUrl}/session`);
if (unauthenticated.status !== 401) throw new Error(`unauthenticated session: expected 401, got ${unauthenticated.status}.`);
console.log('PASS unauthenticated session: 401');
