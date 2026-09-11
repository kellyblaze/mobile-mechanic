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
// appointmentId (CR-015, resolved) is live-verified present on GET /jobs/{id} as of 2026-09-11 —
// kept optional anyway since the `jobs.appointment_id` column is nullable in the schema and the
// no-database fixture fallback path never sets it.
export type Job = {
  id: string;
  customerId?: string;
  mechanicId?: string;
  vehicleId?: string;
  quoteId?: string;
  appointmentId?: string;
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
  // Typed number, but live-verified the real API actually returns this as a JSON string (e.g.
  // "12000" — Postgres bigint serialized through node-postgres). Division/display coerce it fine
  // (`totalMinor / 100` works via JS's loose numeric coercion), but JSON.stringify does not — any
  // call site that re-sends this value in a request body must Number(...) it first. See
  // PayInvoice.tsx's createPayment call, which hit this as a real 422 before the fix.
  totalMinor: number;
  status: string;
  dueAt?: string;
  createdAt?: string;
};
export type Session = { user: { id: string; role: string }; capabilities: string[] };
// Job summary as returned by GET /mechanic/jobs and GET /admin/jobs — live-verified same shape
// on both, distinct from the fuller Job type (no allowedActions/quoteId in the list response).
// appointmentId (CR-015, resolved) live-verified present on both list endpoints as of 2026-09-11.
export type JobSummary = {
  id: string;
  customerId?: string;
  mechanicId?: string;
  appointmentId?: string;
  status: string;
  version: number;
  createdAt?: string;
};
// GET /admin/service-requests has no response schema in openapi.yaml either — shape confirmed
// via curl on 2026-09-10 against Codex's CR-006 implementation (packages/database/src/repositories.ts
// createServiceRequestRepository.listForAdmin): carries customerId directly, which is exactly
// what CR-006 exists to give the quote-issuance screen.
export type AdminServiceRequest = {
  id: string;
  customerId: string;
  vehicleId: string;
  category: string;
  symptoms: string[];
  notes: string | null;
  deliveryMode: string;
  status: string;
  createdAt: string;
  customerEmail: string;
  year: number;
  make: string;
  model: string;
};
// POST /uploads / POST /uploads/{id}/complete response — live-verified via curl on 2026-09-11
// against a real, private Supabase Storage bucket (CR-017: the bucket named in
// SUPABASE_STORAGE_BUCKET didn't exist yet in this dev environment's Supabase project — created
// it, then verified the full three-leg flow: initiate -> PUT the real file bytes straight to
// uploadUrl (no other headers needed beyond content-type; the token is already embedded in the
// URL's query string) -> complete). uploadUrl/uploadToken/expiresInSeconds are only present on
// the initiate response, not the complete response — never log or persist them past the upload
// attempt they're for (they're a short-lived, single-use credential for this exact storageKey).
export type UploadReference = {
  id: string;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  status: string;
  createdAt?: string;
  uploadedAt?: string;
  uploadUrl?: string;
  uploadToken?: string;
  expiresInSeconds?: number;
};
// POST /admin/memberships response shape — live-verified via curl on 2026-09-10 against Codex's
// CR-007 implementation.
export type Membership = { userId: string; businessId: string; role: 'customer' | 'mechanic' | 'admin'; email: string };
// POST /payments response — a real Stripe PaymentIntent id/clientSecret/status, confirmed by
// reading apps/api/src/server.ts's handler directly (no response schema in openapi.yaml).
// clientSecret is what Stripe Elements needs to actually collect and confirm payment client-side.
export type PaymentIntent = { id: string; clientSecret: string; status: string };
export type Refund = { id: string; status: string };
// GET /availability response — {data, available} where `data` lists conflicting appointments AND
// active booking holds in the requested window (empty when free) and `available` is the
// convenience boolean. `source` added when CR-012 shipped — holds now count toward availability,
// not just appointments (live-verified: holding a slot then re-checking it now correctly returns
// available: false). Confirmed live via curl (no response schema in openapi.yaml).
export type AvailabilityConflict = { id: string; startsAt: string; endsAt: string; status: string; source: 'appointment' | 'booking_hold' };
export type AvailabilityCheck = { data: AvailabilityConflict[]; available: boolean };
// POST /booking-holds response — confirmed live via curl on 2026-09-10 against
// packages/database/src/repositories.ts's createBookingRepository.createHold.
export type BookingHold = {
  id: string;
  customerId: string;
  mechanicId: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  status: string;
};
// POST /booking-holds/{id}/confirm response — CR-012, resolved: confirming a hold now really
// does create both a confirmed appointment and a scheduled job in one transaction. Confirmed by
// reading createBookingRepository.confirmHold directly.
export type Appointment = { id: string; customerId: string; mechanicId: string; startsAt: string; endsAt: string; status: string; holdId: string };
export type BookingConfirmation = { appointment: Appointment; job: Job };
// POST /appointments/{id}/cancel response — live-verified via curl against
// packages/database/src/repositories.ts's cancelAppointment, not just read from source: success
// returns this shape (note it omits endsAt/holdId, unlike Appointment above, because the real SQL
// RETURNING clause doesn't select them); 403 FORBIDDEN for a non-participant actor; 404 NOT_FOUND
// once the appointment is no longer in 'confirmed'/'scheduled' status (including re-cancelling an
// already-cancelled one); 409 CANCELLATION_CUTOFF for a customer/mechanic within two hours of the
// start time — confirmed live that an admin bypasses the cutoff and still succeeds. `reason` is
// optional on the request; omitting it live-verified to succeed with cancellationReason: null.
export type CancelledAppointment = {
  id: string;
  customerId: string;
  mechanicId: string;
  startsAt: string;
  status: string;
  version: number;
  cancelledAt: string;
  cancellationReason: string | null;
};

// CR-014, real proxy published in contract 1.9.0 — every shape below confirmed by reading
// apps/api/src/server.ts's handlers directly (no response schema in openapi.yaml). `issues.open/
// critical/last24Hours` on the overview are currently hardcoded to 0 server-side regardless of
// real GlitchTip state — not wired to the issues query yet — so the frontend must not present
// them as live counts. GlitchTip-backed operations (issues list/detail) 503 with
// MONITORING_UNAVAILABLE whenever GLITCHTIP_API_URL/TOKEN/ORG_SLUG/PROJECT_SLUG aren't all set;
// the webhook/reconciliation/uptime/overview operations only need the database, not GlitchTip.
export type MonitoringOverview = {
  environment: string;
  release?: string;
  api: { status: string; checkedAt: string };
  issues: { open: number; critical: number; last24Hours: number };
  webhooks: { failed: number; oldestPendingAt?: string };
  reconciliation: { unpaidSucceededPayments: number; oldestLagMinutes?: number };
};
export type MonitoringIssueSummary = {
  id: string;
  title: string;
  status?: string;
  severity?: string;
  environment?: string;
  release?: string;
  count?: number;
  lastSeenAt?: string;
};
// nextCursor is hardcoded null server-side today regardless of result size — there is no working
// multi-page pagination yet even though the query parameter is accepted and forwarded. A "load
// more" affordance driven by nextCursor will therefore correctly never appear until that ships.
export type MonitoringIssuesPage = { data: MonitoringIssueSummary[]; nextCursor: string | null };
// The detail route passes through GlitchTip's own (redacted) issue object with no field mapping
// applied — unlike the list, which normalizes into MonitoringIssueSummary. GlitchTip's exact
// schema isn't knowable from this codebase alone, so this is deliberately untyped beyond
// Record<string, unknown> and rendered as generic, escaped key/value pairs — never assumed to
// match MonitoringIssueSummary's field names, and always treated as untrusted display text.
export type MonitoringIssueDetail = Record<string, unknown>;
export type MonitoringWebhookStatus = { failed: number; oldestPendingAt?: string };
export type MonitoringReconciliation = { unpaidSucceededPayments: number; oldestLagMinutes?: number };
// Real shape is a single overall API health check, not a per-service array — the mock-mode
// version's list of named uptime checks doesn't reflect anything the server actually tracks yet.
export type MonitoringUptime = { api: { status: string; checkedAt: string } };
export type MonitoringIssueFilters = { severity?: string; status?: string; environment?: string; release?: string; cursor?: string; limit?: number };
// GET /mechanics response — CR-011, resolved. displayName is literally the mechanic's email
// today (read createBookingRepository.listMechanics directly) — not a real display name, but the
// real field the API returns.
export type Mechanic = { id: string; displayName: string };

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
    // content-type: application/json only when there's actually a body — confirmBookingHold and
    // refundPayment are POSTs with no body. Sending the header anyway made Fastify's strict JSON
    // parser reject the empty body outright: found live via confirmBookingHold, which failed with
    // a real 500 ("Body cannot be empty when content-type is set to 'application/json'",
    // FST_ERR_CTP_EMPTY_JSON_BODY) until this was fixed.
    const headers: Record<string, string> = { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.extraHeaders ?? {}) };
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
    initiateUpload: (input: { fileName: string; contentType: string; sizeBytes: number }) => request<{ data: UploadReference }>('/uploads', { method: 'POST', body: input }),
    completeUpload: (id: string) => request<{ data: UploadReference }>(`/uploads/${id}/complete`, { method: 'POST' }),
    // Goes straight to Supabase Storage, not our own API — a different origin entirely, needing
    // no dev-actor/bearer header (the token already embedded in uploadUrl is Supabase's own
    // short-lived, single-use credential for this exact object), so this deliberately doesn't
    // route through request(). Live-verified via curl: a plain PUT with only a content-type
    // header and the raw bytes succeeds.
    uploadFileToSignedUrl: async (uploadUrl: string, file: File): Promise<void> => {
      const response = await f(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!response.ok) throw new Error(`Upload to storage failed (HTTP ${response.status}).`);
    },
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
    issueQuote: (
      requestId: string,
      input: { customerId: string; currency: string; lines: { description: string; amountMinor: number }[] }
    ) => request<{ data: Record<string, unknown> }>(`/admin/service-requests/${requestId}/quotes`, {
      method: 'POST',
      body: input
    }),
    // CR-006, resolved in contract 1.4.0 — replaces the manual request-id/customer-id entry on
    // AdminIssueQuote with a real picker.
    listAdminServiceRequests: (status?: string) =>
      request<{ data: AdminServiceRequest[] }>(`/admin/service-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    // CR-007, resolved as "provisioned accounts" — an admin links an already-signed-up Supabase
    // Auth user (found by email in public.users) to a business role. Does not create the
    // Supabase Auth account itself; that still happens through the approved Supabase/admin
    // process outside this app (see docs/change-requests/CR-007.md).
    provisionMembership: (input: { email: string; role: 'customer' | 'mechanic' | 'admin' }) =>
      request<{ data: Membership }>('/admin/memberships', { method: 'POST', body: input }),
    // Customer-only. CR-009, resolved: invoiceId now links the PaymentIntent server-side — the
    // API rejects it if it isn't this customer's open invoice for the exact amount/currency, and
    // the Stripe webhook marks the invoice paid on success.
    createPayment: (input: { invoiceId?: string; amountMinor: number; currency: string; idempotencyKey: string }) =>
      request<{ data: PaymentIntent }>('/payments', { method: 'POST', body: input }),
    // Admin-only.
    refundPayment: (id: string, idempotencyKey: string) =>
      request<{ data: Refund }>(`/payments/${id}/refund`, { method: 'POST', extraHeaders: { 'idempotency-key': idempotencyKey } }),
    // Unlike every other read here, the raw response is {data, available} — not {data: T} — so
    // AvailabilityCheck already includes both fields; no extra wrapper.
    checkAvailability: (query: { mechanicId: string; startsAt: string; endsAt: string }) =>
      request<AvailabilityCheck>(
        `/availability?mechanicId=${encodeURIComponent(query.mechanicId)}&startsAt=${encodeURIComponent(query.startsAt)}&endsAt=${encodeURIComponent(query.endsAt)}`
      ),
    createBookingHold: (input: { mechanicId: string; startsAt: string; endsAt: string; expiresAt: string; idempotencyKey: string }) =>
      request<{ data: BookingHold }>('/booking-holds', { method: 'POST', body: input }),
    // Customer-only. CR-012, resolved: confirms an active, unexpired hold into a real appointment
    // + job. 409 if the hold is expired, already converted, or otherwise invalid.
    confirmBookingHold: (holdId: string) =>
      request<{ data: BookingConfirmation }>(`/booking-holds/${holdId}/confirm`, { method: 'POST' }),
    // Customer/mechanic/admin — all three roles may cancel (server-side authorization checks the
    // actor is a participant, or admin). No body sent when reason is omitted, matching the
    // confirmBookingHold/refundPayment no-body pattern above (avoids FST_ERR_CTP_EMPTY_JSON_BODY).
    cancelAppointment: (appointmentId: string, reason?: string) =>
      request<{ data: CancelledAppointment }>(`/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: reason ? { reason } : undefined
      }),
    // CR-011, resolved.
    listMechanics: () => request<{ data: Mechanic[] }>('/mechanics'),
    // Admin-only. CR-010, resolved.
    createInvoiceForJob: (jobId: string, input: { currency: string; totalMinor: number }) =>
      request<{ data: Invoice }>(`/admin/jobs/${jobId}/invoices`, { method: 'POST', body: input }),
    // Admin-only. CR-014, resolved. See the type comments above for exactly what's real vs.
    // still-hardcoded server-side.
    getMonitoringOverview: () => request<{ data: MonitoringOverview }>('/admin/monitoring/overview'),
    listMonitoringIssues: (filters: MonitoringIssueFilters) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, String(value));
      const query = params.toString();
      return request<MonitoringIssuesPage>(`/admin/monitoring/issues${query ? `?${query}` : ''}`);
    },
    getMonitoringIssue: (id: string) => request<{ data: MonitoringIssueDetail }>(`/admin/monitoring/issues/${encodeURIComponent(id)}`),
    getMonitoringWebhooks: () => request<{ data: MonitoringWebhookStatus }>('/admin/monitoring/webhooks'),
    getMonitoringReconciliation: () => request<{ data: MonitoringReconciliation }>('/admin/monitoring/reconciliation'),
    getMonitoringUptime: () => request<{ data: MonitoringUptime }>('/admin/monitoring/uptime')
  };
}

export type ApiAdapter = ReturnType<typeof createApiAdapter>;
