import { readdir } from 'node:fs/promises';
const files = (await readdir('packages/database/migrations')).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) throw new Error('No migrations found');
console.log(`Migration files present (${files.length}):`);
for (const file of files) console.log(`- ${file}`);
console.log('Apply these files with your PostgreSQL migration runner; no database credentials are used by this check.');
