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

  it('creates a payment intent with amount, currency, and idempotency key', async () => {
    const fetchImpl = mockFetch(201, { data: { id: 'pi_1', clientSecret: 'pi_1_secret_abc', status: 'requires_payment_method' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.createPayment({ amountMinor: 5000, currency: 'USD', idempotencyKey: 'idem-12345678' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/payments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ amountMinor: 5000, currency: 'USD', idempotencyKey: 'idem-12345678' });
    expect(result.data.clientSecret).toBe('pi_1_secret_abc');
  });

  it('sends the Idempotency-Key header when refunding a payment', async () => {
    const fetchImpl = mockFetch(200, { data: { id: 're_1', status: 'succeeded' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.refundPayment('pi_1', 'idem-87654321');

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe('http://api.test/payments/pi_1/refund');
    expect(init.method).toBe('POST');
    expect(init.headers['idempotency-key']).toBe('idem-87654321');
  });

  it('checks availability with the mechanic and window as query params', async () => {
    const fetchImpl = mockFetch(200, { data: [], available: true });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.checkAvailability({ mechanicId: 'mech-1', startsAt: '2026-09-15T14:00:00.000Z', endsAt: '2026-09-15T15:00:00.000Z' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(
      'http://api.test/availability?mechanicId=mech-1&startsAt=2026-09-15T14%3A00%3A00.000Z&endsAt=2026-09-15T15%3A00%3A00.000Z'
    );
    expect(result.available).toBe(true);
  });

  it('creates a booking hold with the full input', async () => {
    const fetchImpl = mockFetch(201, {
      data: { id: 'hold-1', customerId: 'cust-1', mechanicId: 'mech-1', startsAt: '2026-09-15T14:00:00.000Z', endsAt: '2026-09-15T15:00:00.000Z', expiresAt: '2026-09-15T13:30:00.000Z', status: 'active' }
    });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    await api.createBookingHold({
      mechanicId: 'mech-1',
      startsAt: '2026-09-15T14:00:00.000Z',
      endsAt: '2026-09-15T15:00:00.000Z',
      expiresAt: '2026-09-15T13:30:00.000Z',
      idempotencyKey: 'idem-12345678'
    });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/booking-holds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      mechanicId: 'mech-1',
      startsAt: '2026-09-15T14:00:00.000Z',
      endsAt: '2026-09-15T15:00:00.000Z',
      expiresAt: '2026-09-15T13:30:00.000Z',
      idempotencyKey: 'idem-12345678'
    });
  });

  it('confirms a booking hold with no request body', async () => {
    const fetchImpl = mockFetch(201, {
      data: {
        appointment: { id: 'appt-1', customerId: 'cust-1', mechanicId: 'mech-1', startsAt: '2026-09-15T14:00:00.000Z', endsAt: '2026-09-15T15:00:00.000Z', status: 'confirmed', holdId: 'hold-1' },
        job: { id: 'job-1', customerId: 'cust-1', mechanicId: 'mech-1', status: 'scheduled', version: 1 }
      }
    });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.confirmBookingHold('hold-1');

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe('http://api.test/booking-holds/hold-1/confirm');
    expect(init.method).toBe('POST');
    // Regression: sending content-type: application/json with no body made Fastify's strict JSON
    // parser reject the request outright (found live via this exact call — see apiAdapter.ts).
    expect(init.headers['content-type']).toBeUndefined();
    expect(result.data.job.status).toBe('scheduled');
  });

  it('lists mechanics', async () => {
    const fetchImpl = mockFetch(200, { data: [{ id: 'mech-1', displayName: 'mechanic-demo@local.test' }] });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    const result = await api.listMechanics();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/mechanics');
    expect(result.data).toHaveLength(1);
  });

  it('creates an invoice for a job', async () => {
    const fetchImpl = mockFetch(201, { data: { id: 'inv-1', jobId: 'job-1', customerId: 'cust-1', currency: 'USD', totalMinor: 9900, status: 'open' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.createInvoiceForJob('job-1', { currency: 'USD', totalMinor: 9900 });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, { method: string; body: string }];
    expect(url).toBe('http://api.test/admin/jobs/job-1/invoices');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ currency: 'USD', totalMinor: 9900 });
  });

  it('includes invoiceId in the payment request when provided', async () => {
    const fetchImpl = mockFetch(201, { data: { id: 'pi_1', clientSecret: 'pi_1_secret_abc', status: 'requires_payment_method' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'customer-demo', role: 'customer' }, fetchImpl });

    await api.createPayment({ invoiceId: 'inv-1', amountMinor: 9900, currency: 'USD', idempotencyKey: 'idem-12345678' });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as { body: string };
    expect(JSON.parse(init.body)).toEqual({ invoiceId: 'inv-1', amountMinor: 9900, currency: 'USD', idempotencyKey: 'idem-12345678' });
  });

  it('requests the monitoring overview from the correct path', async () => {
    const fetchImpl = mockFetch(200, { data: { environment: 'development', api: { status: 'healthy', checkedAt: '2026-09-10T00:00:00.000Z' }, issues: { open: 0, critical: 0, last24Hours: 0 }, webhooks: { failed: 0 }, reconciliation: { unpaidSucceededPayments: 0 } } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.getMonitoringOverview();

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/monitoring/overview');
  });

  it('encodes monitoring issue filters as query params', async () => {
    const fetchImpl = mockFetch(200, { data: [], nextCursor: null });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.listMonitoringIssues({ severity: 'error', status: 'unresolved', limit: 10 });

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/monitoring/issues?severity=error&status=unresolved&limit=10');
  });

  it('omits query params entirely when no monitoring issue filters are set', async () => {
    const fetchImpl = mockFetch(200, { data: [], nextCursor: null });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.listMonitoringIssues({});

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/monitoring/issues');
  });

  it('requests a monitoring issue detail by id', async () => {
    const fetchImpl = mockFetch(200, { data: { id: 'iss-1', title: 'Something broke' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.getMonitoringIssue('iss-1');

    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('http://api.test/admin/monitoring/issues/iss-1');
  });

  it('surfaces a 503 from the monitoring issues endpoint as a typed ApiRequestError', async () => {
    const fetchImpl = mockFetch(503, { error: { code: 'MONITORING_UNAVAILABLE', message: 'GlitchTip monitoring is not configured.', requestId: 'req-1' } });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await expect(api.listMonitoringIssues({})).rejects.toMatchObject({ status: 503, code: 'MONITORING_UNAVAILABLE' });
  });

  it('requests monitoring webhooks, reconciliation, and uptime from their own paths', async () => {
    const fetchImpl = mockFetch(200, { data: {} });
    const api = createApiAdapter({ baseUrl: 'http://api.test', actor: { userId: 'admin-demo', role: 'admin' }, fetchImpl });

    await api.getMonitoringWebhooks();
    await api.getMonitoringReconciliation();
    await api.getMonitoringUptime();

    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe('http://api.test/admin/monitoring/webhooks');
    expect(calls[1][0]).toBe('http://api.test/admin/monitoring/reconciliation');
    expect(calls[2][0]).toBe('http://api.test/admin/monitoring/uptime');
  });
});
