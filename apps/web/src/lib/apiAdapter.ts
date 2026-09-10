// Single API adapter/query layer (docs/architecture.md, docs/frontend-handoff.md: "Use the
// generated client through one adapter; do not hard-code business rules or API field names").
//
// The generated client (packages/contracts/generated/client.ts) only exports get<T>() with no
// header support and no mutation methods, even though the contract defines POST operations and
// requires X-Dev-User-Id/X-Dev-Role/Idempotency-Key headers on authenticated routes. Every method
// below is exact to packages/contracts/openapi.yaml (path, verb, headers, request/response shape).
// See docs/change-requests/CR-001.md: once the generated client adds typed mutations and header
// injection, this file's request() helper can delegate to it instead of calling fetch directly.
import { CONTRACT_VERSION } from '../../../../packages/contracts/generated/client.js';

export type DevActor = { userId: string; role: 'customer' | 'mechanic' | 'admin' };

export type Service = { id: string; name: string; delivery: string[]; pricingPath: string };
export type Vehicle = { id: string; customerId?: string; year: number; make: string; model: string; mileage?: number; vin?: string };
// allowedActions is optional, not required: live-verified against the real Postgres-backed
// GET /jobs/{id} (persistence:"postgres") on 2026-09-10 — the response omits it entirely for a
// freshly seeded job, so treating it as always-present would crash real (not just fixture) data.
export type Job = {
  id: string;
  customerId?: string;
  mechanicId?: string;
  vehicleId?: string;
  quoteId?: string;
  status: string;
  version: number;
  allowedActions?: string[];
};
export type Quote = { id: string; customerId?: string; status: string; version: number; currency: string; totalMinor: number; lines: { description: string; amountMinor: number }[] };
// GET /invoices has no response schema in openapi.yaml ("description: Customer invoices" only) —
// shape confirmed by reading packages/database/src/repositories.ts's createInvoiceRepository
// query directly, not guessed. Customer-only (403 for mechanic/admin, verified live via curl).
export type Invoice = {
  id: string;
  jobId?: string;
  customerId?: string;
  currency: string;
  totalMinor: number;
  status: string;
  dueAt?: string;
  createdAt?: string;
};
export type Session = { user: { id: string; role: string }; capabilities: string[] };
// Job summary as returned by GET /mechanic/jobs and GET /admin/jobs — live-verified same shape
// on both, distinct from the fuller Job type (no allowedActions/quoteId in the list response).
export type JobSummary = {
  id: string;
  customerId?: string;
  mechanicId?: string;
  status: string;
  version: number;
  createdAt?: string;
};

export type ApiErrorBody = { error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string } };

function isApiErrorBody(payload: unknown): payload is ApiErrorBody {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return false;
  const err = (payload as { error: unknown }).error;
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code: unknown }).code === 'string' &&
    typeof (err as { message: unknown }).message === 'string' &&
    typeof (err as { requestId: unknown }).requestId === 'string'
  );
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly requestId: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.fieldErrors = body.error.fieldErrors;
    this.requestId = body.error.requestId;
  }
}

export type ApiAdapterOptions = {
  baseUrl: string;
  actor?: DevActor;
  // Real Supabase session access token. Live-verified against apps/api/src/server.ts's
  // AUTH_MODE=managed preHandler hook: it accepts "Authorization: Bearer <token>", verifies it
  // against the configured issuer/JWKS, and resolves the caller's id/role via `memberships` —
  // no other request shape changes. Takes priority over `actor` when both are somehow set.
  accessToken?: string;
  fetchImpl?: typeof fetch;
};

type AdapterRequestInit = { method?: string; body?: unknown; extraHeaders?: Record<string, string> };

export function createApiAdapter(options: ApiAdapterOptions) {
  const f = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init: AdapterRequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.extraHeaders ?? {}) };
    if (options.accessToken) {
      headers['authorization'] = `Bearer ${options.accessToken}`;
    } else if (options.actor) {
      headers['x-dev-user-id'] = options.actor.userId;
      headers['x-dev-role'] = options.actor.role;
    }
    const response = await f(options.baseUrl + path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback: ApiErrorBody = { error: { code: 'UNKNOWN_ERROR', message: 'The request failed.', requestId: 'unknown' } };
      throw new ApiRequestError(response.status, isApiErrorBody(payload) ? payload : fallback);
    }
    return payload as T;
  }

  return {
    contractVersion: CONTRACT_VERSION,
    getSession: () => request<Session>('/session'),
    listServiceCatalog: () => request<{ data: Service[]; meta?: Record<string, unknown> }>('/service-catalog'),
    listVehicles: () => request<{ data: Vehicle[] }>('/vehicles'),
    // CR-001 stopgap — see file header.
    createVehicle: (input: { year: number; make: string; model: string; mileage?: number; vin?: string }) =>
      request<{ data: Vehicle }>('/vehicles', { method: 'POST', body: input }),
    getJob: (id: string) => request<{ data: Job }>(`/jobs/${id}`),
    getQuote: (id: string) => request<{ data: Quote }>(`/quotes/${id}`),
    getVehicleHistory: (id: string) => request<{ data: Record<string, unknown>[] }>(`/vehicles/${id}/history`),
    listInvoices: () => request<{ data: Invoice[] }>('/invoices'),
    createServiceRequest: (input: { vehicleId: string; category: string; symptoms: string[]; notes?: string; attachmentIds?: string[] }) => request<{ data: Record<string, unknown> }>('/service-requests', { method: 'POST', body: input }),
    initiateUpload: (input: { fileName: string; contentType: string; sizeBytes: number }) => request<{ data: Record<string, unknown> }>('/uploads', { method: 'POST', body: input }),
    listFindings: (id: string) => request<{ data: Record<string, unknown>[] }>(`/jobs/${id}/findings`),
    // openapi.yaml declares `category` as a plain string with no enum, but the live API rejects
    // anything outside this set (confirmed via curl: 422 "Invalid enum value. Expected
    // 'recommended_now' | 'plan_for_later' | 'monitor'") — typed to the real values, not the
    // contract's (understated) free-text implication.
    addFinding: (id: string, input: { category: 'recommended_now' | 'plan_for_later' | 'monitor'; note: string; attachmentId?: string }) =>
      request<{ data: Record<string, unknown> }>(`/jobs/${id}/findings`, { method: 'POST', body: input }),
    listMessages: (id: string) => request<{ data: Record<string, unknown>[] }>(`/jobs/${id}/messages`),
    sendMessage: (id: string, body: string) => request<{ data: Record<string, unknown> }>(`/jobs/${id}/messages`, { method: 'POST', body: { body }, extraHeaders: { 'idempotency-key': crypto.randomUUID() } }),
    // CR-001 stopgap — see file header.
    acceptQuote: (id: string, command: { expectedVersion: number; idempotencyKey: string }) =>
      request<{ data: Quote }>(`/quotes/${id}/accept`, {
        method: 'POST',
        body: command,
        extraHeaders: { 'idempotency-key': command.idempotencyKey }
      }),
    // Mechanic/admin operations, added for the mechanic/admin screens. All exact to
    // openapi.yaml; request/response shapes live-verified via curl on 2026-09-10 (see commit).
    listMechanicJobs: () => request<{ data: JobSummary[] }>('/mechanic/jobs'),
    listAdminJobs: () => request<{ data: JobSummary[] }>('/admin/jobs'),
    transitionJob: (id: string, input: { expectedVersion: number; status: string }) =>
      request<{ data: Job }>(`/jobs/${id}/transitions`, { method: 'POST', body: input }),
    completeJob: (id: string, input: { summary: string }) =>
      request<{ data: { job: Job; report: Record<string, unknown> } }>(`/jobs/${id}/completion-report`, {
        method: 'POST',
        body: input
      }),
    // customerId/lines are required by the contract's QuoteInput but there's no endpoint to look
    // a service request's customer up by id (CR-006) — admin currently has to know/enter it.
    issueQuote: (
      requestId: string,
      input: { customerId: string; currency: string; lines: { description: string; amountMinor: number }[] }
    ) => request<{ data: Record<string, unknown> }>(`/admin/service-requests/${requestId}/quotes`, {
      method: 'POST',
      body: input
    })
  };
}

export type ApiAdapter = ReturnType<typeof createApiAdapter>;
