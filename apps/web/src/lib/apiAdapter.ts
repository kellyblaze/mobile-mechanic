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
export type Job = { id: string; customerId?: string; mechanicId?: string; status: string; version: number; allowedActions: string[] };
export type Quote = { id: string; customerId?: string; status: string; version: number; currency: string; totalMinor: number; lines: { description: string; amountMinor: number }[] };
export type Session = { user: { id: string; role: string }; capabilities: string[] };

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
  fetchImpl?: typeof fetch;
};

type AdapterRequestInit = { method?: string; body?: unknown; extraHeaders?: Record<string, string> };

export function createApiAdapter(options: ApiAdapterOptions) {
  const f = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init: AdapterRequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.extraHeaders ?? {}) };
    if (options.actor) {
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
    // CR-001 stopgap — see file header.
    acceptQuote: (id: string, command: { expectedVersion: number; idempotencyKey: string }) =>
      request<{ data: Quote }>(`/quotes/${id}/accept`, {
        method: 'POST',
        body: command,
        extraHeaders: { 'idempotency-key': command.idempotencyKey }
      })
  };
}

export type ApiAdapter = ReturnType<typeof createApiAdapter>;
