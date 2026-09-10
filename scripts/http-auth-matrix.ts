import 'dotenv/config';

const base = process.env.AUTH_MATRIX_BASE_URL ?? 'http://127.0.0.1:3003/api/v1';
const actors = { customer: { 'x-dev-user-id': 'customer-demo', 'x-dev-role': 'customer' }, mechanic: { 'x-dev-user-id': 'mechanic-demo', 'x-dev-role': 'mechanic' }, admin: { 'x-dev-user-id': 'admin-demo', 'x-dev-role': 'admin' } };
const checks: Array<[string, string, keyof typeof actors, number]> = [
  ['customer session', '/session', 'customer', 200], ['customer vehicles', '/vehicles', 'customer', 200], ['mechanic cannot list customer vehicles', '/vehicles', 'mechanic', 403], ['admin cannot list customer vehicles', '/vehicles', 'admin', 403],
  ['customer repair room', '/jobs/44444444-4444-4444-8444-444444444444', 'customer', 200], ['assigned mechanic repair room', '/jobs/44444444-4444-4444-8444-444444444444', 'mechanic', 200], ['admin repair room', '/jobs/44444444-4444-4444-8444-444444444444', 'admin', 200]
];
let failures = 0;
for (const [name, path, actor, expected] of checks) { const response = await fetch(base + path, { headers: actors[actor] }); const ok = response.status === expected; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: expected ${expected}, got ${response.status}`); if (!ok) failures++; }
if (failures) process.exitCode = 1;
