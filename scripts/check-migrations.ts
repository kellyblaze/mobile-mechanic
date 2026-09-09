import { readdir, readFile } from 'node:fs/promises';
import { createDatabase } from '../packages/database/src/client.js';

const files = (await readdir('packages/database/migrations')).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) throw new Error('No migrations found');
console.log(`Migration files present (${files.length}):`);
const db = createDatabase();
if (!db) { console.log('DATABASE_URL is not set; migration execution skipped.'); process.exit(0); }
await db.withTransaction(async (client) => {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of files) { const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]); if (applied.rowCount) continue; await client.query(await readFile(`packages/database/migrations/${file}`, 'utf8')); await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]); console.log(`Applied ${file}`); }
});
await db.close();
