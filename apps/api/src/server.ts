import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { fixtureState, type Role } from '../../../packages/domain/src/state.js';

const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
await app.register(helmet);
await app.register(cors, { origin: process.env.APP_ORIGIN ?? 'http://localhost:5173', credentials: true });

const requestId = (request: FastifyRequest) => String(request.id);
function error(reply: FastifyReply, statusCode: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
  return reply.code(statusCode).send({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), requestId: requestId(reply.request) } });
}
function actor(request: FastifyRequest): { id: string; role: Role } | null {
  const id = request.headers['x-dev-user-id'];
  const role = request.headers['x-dev-role'];
  if (typeof id !== 'string' || !['customer', 'mechanic', 'admin'].includes(String(role))) return null;
  return { id, role: role as Role };
}
function requireActor(request: FastifyRequest, reply: FastifyReply) { const a = actor(request); if (!a) { error(reply, 401, 'UNAUTHENTICATED', 'A valid development session is required.'); return null; } return a; }

app.get('/health', async () => ({ status: 'ok', contractVersion: '1.0.0', mockMode: process.env.MOCK_MODE === 'true' }));
app.get('/api/v1/session', async (request, reply) => { const a = requireActor(request, reply); if (!a) return; return { user: { id: a.id, role: a.role }, capabilities: a.role === 'admin' ? ['quotes:write', 'jobs:write', 'catalog:write'] : ['vehicles:read', 'requests:write'] }; });
app.get('/api/v1/service-catalog', async () => ({ data: fixtureState.services, meta: { source: process.env.MOCK_MODE === 'true' ? 'fixture' : 'development-adapter' } }));
app.get('/api/v1/vehicles', async (request, reply) => { const a = requireActor(request, reply); if (!a) return; if (a.role !== 'customer') return error(reply, 403, 'FORBIDDEN', 'Only customers can access household vehicles.'); return { data: fixtureState.vehicles.filter((v) => v.customerId === a.id) }; });
const vehicleBody = z.object({ year: z.number().int().min(1886).max(2100), make: z.string().min(1).max(80), model: z.string().min(1).max(80), mileage: z.number().int().nonnegative().optional(), vin: z.string().length(17).optional() });
app.post('/api/v1/vehicles', async (request, reply) => { const a = requireActor(request, reply); if (!a) return; if (a.role !== 'customer') return error(reply, 403, 'FORBIDDEN', 'Only customers can create vehicles.'); const parsed = vehicleBody.safeParse(request.body); if (!parsed.success) return error(reply, 422, 'VALIDATION_ERROR', 'Vehicle input is invalid.', parsed.error.flatten().fieldErrors); const vehicle = { id: `vehicle-${fixtureState.vehicles.length + 1}`, customerId: a.id, year: parsed.data.year, make: parsed.data.make, model: parsed.data.model, mileage: parsed.data.mileage, ...(parsed.data.vin ? { vin: parsed.data.vin } : {}) }; fixtureState.vehicles.push(vehicle); return reply.code(201).send({ data: vehicle }); });
app.get('/api/v1/jobs/:id', async (request, reply) => { const a = requireActor(request, reply); if (!a) return; const job = fixtureState.jobs.find((j) => j.id === (request.params as { id: string }).id); if (!job) return error(reply, 404, 'NOT_FOUND', 'Job not found.'); if (a.role === 'customer' && job.customerId !== a.id) return error(reply, 403, 'FORBIDDEN', 'You are not allowed to access this job.'); if (a.role === 'mechanic' && job.mechanicId !== a.id) return error(reply, 403, 'FORBIDDEN', 'This job is not assigned to you.'); return { data: job }; });
app.post('/api/v1/quotes/:id/accept', async (request, reply) => { const a = requireActor(request, reply); if (!a) return; if (a.role !== 'customer') return error(reply, 403, 'FORBIDDEN', 'Only the customer may accept a quote.'); const quote = fixtureState.quotes.find((q) => q.id === (request.params as { id: string }).id); if (!quote || quote.customerId !== a.id) return error(reply, 404, 'NOT_FOUND', 'Quote not found.'); const body = z.object({ expectedVersion: z.number().int().positive(), idempotencyKey: z.string().min(8) }).safeParse(request.body); if (!body.success) return error(reply, 422, 'VALIDATION_ERROR', 'Acceptance input is invalid.'); if (body.data.expectedVersion !== quote.version) return error(reply, 409, 'STALE_VERSION', 'Quote changed; retrieve the latest version before accepting.'); if (quote.status !== 'issued') return error(reply, 409, 'QUOTE_NOT_ACCEPTABLE', 'Only issued quotes can be accepted.'); quote.status = 'accepted'; quote.version += 1; return { data: quote }; });
app.setErrorHandler((err, request, reply) => { request.log.error(err); return error(reply, 500, 'INTERNAL_ERROR', 'The server could not complete the request.'); });
const port = Number(process.env.PORT ?? 3000); await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
