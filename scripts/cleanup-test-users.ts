import 'dotenv/config';
import pg from 'pg';

const prefix = process.env.TEST_USER_PREFIX ?? 'codex-';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DATABASE_URL) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL are required.');
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const users = await db.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE email LIKE $1 ORDER BY email', [`${prefix}%`]);
for (const user of users.rows) {
  await db.query('DELETE FROM memberships WHERE user_id = $1', [user.id]);
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers });
  if (!response.ok && response.status !== 404) throw new Error(`Could not delete ${user.email}: HTTP ${response.status}.`);
  console.log(`Deleted disposable user ${user.email}.`);
}
await db.end();
console.log(`Cleanup complete: ${users.rows.length} disposable users removed.`);
