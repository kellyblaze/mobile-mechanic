import 'dotenv/config';
import pg from 'pg';

const baseUrl = process.env.MANAGED_AUTH_BASE_URL ?? 'http://127.0.0.1:3006/api/v1';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DATABASE_URL) {
  throw new Error('Supabase URL/keys and DATABASE_URL are required.');
}

const stamp = Date.now();
const email = process.env.TEST_SUPABASE_EMAIL ?? `codex-managed-${stamp}@example.com`;
const password = process.env.TEST_SUPABASE_PASSWORD ?? `Mm!${stamp}-LocalTest-9`;
if (!process.env.TEST_SUPABASE_EMAIL) {
  const adminResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!adminResponse.ok) throw new Error(`Supabase test user creation failed with HTTP ${adminResponse.status}.`);
  const created = await adminResponse.json() as { id?: string };
  if (!created.id) throw new Error('Supabase test user creation returned no id.');
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const business = await db.query<{ id: string }>('SELECT id FROM businesses ORDER BY created_at LIMIT 1');
  if (!business.rows[0]) throw new Error('No seeded business exists.');
  await db.query('INSERT INTO memberships (user_id, business_id, role) VALUES ($1,$2,$3) ON CONFLICT (user_id,business_id) DO UPDATE SET role=EXCLUDED.role', [created.id, business.rows[0].id, 'customer']);
  await db.end();
}

const login = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Supabase login failed with HTTP ${login.status}.`);
const session = await login.json() as { access_token?: string };
if (!session.access_token) throw new Error('Supabase login returned no access token.');

const headers = { authorization: `Bearer ${session.access_token}` };
const get = async (path: string) => {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}.`);
  return response.json();
};
const sessionResponse = await get('/session') as { user: { role: string } };
const vehiclesResponse = await get('/vehicles') as { data: unknown[] };
const deniedJob = await fetch(`${baseUrl}/jobs/44444444-4444-4444-8444-444444444444`, { headers });
if (![403, 404].includes(deniedJob.status)) throw new Error(`Unauthorized seeded job access returned HTTP ${deniedJob.status}.`);
console.log(`Managed JWT journey passed: role=${sessionResponse.user.role}, vehicles=${vehiclesResponse.data.length}, unrelated job denied with HTTP ${deniedJob.status}.`);
