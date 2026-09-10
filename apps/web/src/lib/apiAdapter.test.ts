import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, createApiAdapter } from './apiAdapter.js';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })) as unknown as typeof fetch;
}

describe('createApiAdapter', () => {
  it('attaches development session headers to every request', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    await api.listVehicles();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as { headers: Record<string, string> };
    expect(init.headers['x-dev-user-id']).toBe('customer-demo');
    expect(init.headers['x-dev-role']).toBe('customer');
  });

  it('attaches a real session as an Authorization Bearer header instead of dev headers', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', accessToken: 'real-jwt-abc123', fetchImpl });

    await api.listVehicles();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as { headers: Record<string, string> };
    expect(init.headers['authorization']).toBe('Bearer real-jwt-abc123');
    expect(init.headers['x-dev-user-id']).toBeUndefined();
    expect(init.headers['x-dev-role']).toBeUndefined();
  });

  it('throws a typed ApiRequestError carrying field errors on a 422 response', async () => {
    const fetchImpl = mockFetch(422, {
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle input is invalid.', fieldErrors: { year: ['Required'] }, requestId: 'req-1' }
    });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    try {
      await api.createVehicle({ year: 0, make: '', model: '' });
      expect.unreachable('expected createVehicle to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).code).toBe('VALIDATION_ERROR');
      expect((error as ApiRequestError).fieldErrors).toEqual({ year: ['Required'] });
    }
  });

  it('sends the Idempotency-Key header when accepting a quote', async () => {
    const fetchImpl = mockFetch(200, { data: { id: 'quote-1', status: 'accepted', version: 2, currency: 'USD', totalMinor: 12900, lines: [] } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    await api.acceptQuote('quote-1', { expectedVersion: 1, idempotencyKey: 'idem-12345678' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe('http://api.test/quotes/quote-1/accept');
    expect(init.method).toBe('POST');
    expect(init.headers['idempotency-key']).toBe('idem-12345678');
  });

  it('surfaces a 409 conflict distinctly from validation errors', async () => {
    const fetchImpl = mockFetch(409, { error: { code: 'STALE_VERSION', message: 'Quote changed; retrieve the latest version before accepting.', requestId: 'req-2' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    await expect(api.acceptQuote('quote-1', { expectedVersion: 1, idempotencyKey: 'idem-12345678' })).rejects.toMatchObject({
      status: 409,
      code: 'STALE_VERSION'
    });
  });

  it('returns the created vehicle on a successful 201 response', async () => {
    const created = { id: 'vehicle-2', customerId: 'customer-demo', year: 2018, make: 'Honda', model: 'Civic' };
    const fetchImpl = mockFetch(201, { data: created });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.createVehicle({ year: 2018, make: 'Honda', model: 'Civic' });

    expect(result.data).toEqual(created);
  });

  it('falls back to a generic error when the server returns a body that does not match the ApiError shape', async () => {
    // e.g. Fastify's default 404 handler shape ({message, error, statusCode}), not this project's {error:{code,message,requestId}} envelope.
    const fetchImpl = mockFetch(404, { statusCode: 404, error: 'Not Found', message: 'Route GET:/api/v1/unknown not found' });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    try {
      await api.listVehicles();
      expect.unreachable('expected listVehicles to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).code).toBe('UNKNOWN_ERROR');
    }
  });

  it('requests the mechanic job list from the correct path', async () => {
    const fetchImpl = mockFetch(200, { data: [{ id: 'job-1', status: 'scheduled', version: 1 }] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'mechanic-demo', role: 'mechanic' }, fetchImpl });

    const result = await api.listMechanicJobs();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/mechanic/jobs');
    expect(result.data).toHaveLength(1);
  });

  it('requests the admin job list from the correct path', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.listAdminJobs();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/jobs');
  });

  it('posts a status transition with the expected version', async () => {
    const fetchImpl = mockFetch(200, { data: { id: 'job-1', status: 'in_progress', version: 2 } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'mechanic-demo', role: 'mechanic' }, fetchImpl });

    await api.transitionJob('job-1', { expectedVersion: 1, status: 'in_progress' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/jobs/job-1/transitions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ expectedVersion: 1, status: 'in_progress' });
  });

  it('posts a completion report summary', async () => {
    const fetchImpl = mockFetch(200, { data: { job: { id: 'job-1', status: 'completed', version: 3 }, report: {} } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'mechanic-demo', role: 'mechanic' }, fetchImpl });

    await api.completeJob('job-1', { summary: 'Replaced brake pads.' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/jobs/job-1/completion-report');
    expect(JSON.parse(init.body)).toEqual({ summary: 'Replaced brake pads.' });
  });

  it('posts a finding with category and note', async () => {
    const fetchImpl = mockFetch(201, { data: { id: 'finding-1', category: 'recommended_now', note: 'Pads worn thin.' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'mechanic-demo', role: 'mechanic' }, fetchImpl });

    await api.addFinding('job-1', { category: 'recommended_now', note: 'Pads worn thin.' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/jobs/job-1/findings');
    expect(JSON.parse(init.body)).toEqual({ category: 'recommended_now', note: 'Pads worn thin.' });
  });

  it('requests invoices from the correct path', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.listInvoices();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/invoices');
    expect(result.data).toEqual([]);
  });

  it('issues a quote against a service request with lines', async () => {
    const fetchImpl = mockFetch(201, { data: { id: 'quote-1' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.issueQuote('request-1', {
      customerId: 'customer-1',
      currency: 'USD',
      lines: [{ description: 'Diagnostic appointment', amountMinor: 9900 }]
    });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/admin/service-requests/request-1/quotes');
    expect(JSON.parse(init.body)).toEqual({
      customerId: 'customer-1',
      currency: 'USD',
      lines: [{ description: 'Diagnostic appointment', amountMinor: 9900 }]
    });
  });

  it('lists admin service requests with an optional status filter', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.listAdminServiceRequests('submitted');

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/service-requests?status=submitted');
  });

  it('omits the status query param when listing admin service requests without a filter', async () => {
    const fetchImpl = mockFetch(200, { data: [] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.listAdminServiceRequests();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/service-requests');
  });

  it('provisions a membership by email and role', async () => {
    const fetchImpl = mockFetch(201, { data: { userId: 'user-1', businessId: 'biz-1', role: 'customer', email: 'a@example.com' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.provisionMembership({ email: 'a@example.com', role: 'customer' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/admin/memberships');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@example.com', role: 'customer' });
  });
});
