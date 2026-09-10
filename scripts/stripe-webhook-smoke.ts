import 'dotenv/config';
import { createHmac } from 'node:crypto';

const base = process.env.STRIPE_WEBHOOK_BASE_URL ?? 'http://127.0.0.1:3003/api/v1/webhooks/stripe';
const secret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secret || secret.includes('<')) throw new Error('Set STRIPE_WEBHOOK_SECRET to a test value for this smoke test.');
const payload = JSON.stringify({ id: `evt_smoke_${Date.now()}`, object: 'event', type: 'payment_intent.succeeded', data: { object: { id: `pi_smoke_${Date.now()}`, object: 'payment_intent', metadata: { idempotencyKey: 'smoke-payment-key' } } } });
const timestamp = Math.floor(Date.now() / 1000); const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex'); const headers = { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` };
const first = await fetch(base, { method: 'POST', headers, body: payload }); const firstBody = await first.json(); if (first.status !== 200 || firstBody.received !== true) throw new Error(`First webhook failed: ${first.status}`);
const second = await fetch(base, { method: 'POST', headers, body: payload }); const secondBody = await second.json(); if (second.status !== 200 || secondBody.duplicate !== true) throw new Error(`Duplicate webhook failed: ${second.status}`);
console.log('Stripe webhook signature and duplicate-event smoke test passed.');
