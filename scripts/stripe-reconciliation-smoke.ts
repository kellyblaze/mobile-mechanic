import 'dotenv/config';
import Stripe from 'stripe';
import pg from 'pg';

const apiBase = process.env.PAYMENT_SMOKE_BASE_URL ?? 'http://127.0.0.1:3006/api/v1';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY) throw new Error('Supabase, database, and Stripe configuration is required.');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const business = await db.query<{ id: string }>('SELECT id FROM businesses ORDER BY created_at LIMIT 1');
if (!business.rows[0]) throw new Error('No seeded business exists.');

const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
const createActor = async (role: 'customer' | 'admin') => {
  const email = `codex-payment-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = `Mm!${Date.now()}-${role}-LocalTest-9`;
  const createdResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!createdResponse.ok) throw new Error(`Could not create ${role} payment user: HTTP ${createdResponse.status}.`);
  const created = await createdResponse.json() as { id?: string };
  if (!created.id) throw new Error(`No id returned for ${role} payment user.`);
  await db.query('INSERT INTO memberships (user_id,business_id,role) VALUES ($1,$2,$3) ON CONFLICT (user_id,business_id) DO UPDATE SET role=EXCLUDED.role', [created.id, business.rows[0].id, role]);
  const login = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`${role} payment login failed: HTTP ${login.status}.`);
  const token = (await login.json() as { access_token?: string }).access_token;
  if (!token) throw new Error(`${role} payment login returned no token.`);
  return { id: created.id, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } };
};
const customer = await createActor('customer');
const admin = await createActor('admin');
const key = `payment-smoke-${Date.now()}`;
const createResponse = await fetch(`${apiBase}/payments`, { method: 'POST', headers: { ...customer.headers, 'idempotency-key': key }, body: JSON.stringify({ amountMinor: 100, currency: 'USD', idempotencyKey: key }) });
if (createResponse.status !== 201) throw new Error(`Application payment creation failed: HTTP ${createResponse.status}.`);
const createdPayment = await createResponse.json() as { data: { id: string } };
const intent = await stripe.paymentIntents.confirm(createdPayment.data.id, { payment_method: 'pm_card_visa' });
if (intent.status !== 'succeeded') throw new Error(`Stripe test confirmation did not succeed: ${intent.status}.`);

const waitForStatus = async (expected: string) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await db.query<{ status: string }>('SELECT status FROM payment_attempts WHERE provider_reference = $1 ORDER BY created_at DESC LIMIT 1', [intent.id]);
    if (result.rows[0]?.status === expected) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Payment attempt ${intent.id} did not reach ${expected}.`);
};
await waitForStatus('succeeded');
const refundKey = `refund-smoke-${Date.now()}`;
const refundResponse = await fetch(`${apiBase}/payments/${intent.id}/refund`, { method: 'POST', headers: { ...admin.headers, 'idempotency-key': refundKey }, body: '{}' });
if (refundResponse.status !== 200) throw new Error(`Application refund failed: HTTP ${refundResponse.status}.`);
await waitForStatus('refunded');
console.log(`Stripe reconciliation passed: payment ${intent.id} succeeded and refunded.`);
await db.end();
