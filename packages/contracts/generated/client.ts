// Generated from openapi.yaml. Do not edit.
export const CONTRACT_VERSION = '1.0.0';
export type ApiError = { error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string } };
export type ApiClientOptions = { baseUrl: string; fetchImpl?: typeof fetch };
export function createApiClient(options: ApiClientOptions) { const f = options.fetchImpl ?? fetch; return { async get<T>(path: string): Promise<T> { const r = await f(options.baseUrl + path, { credentials: 'include' }); if (!r.ok) throw await r.json(); return r.json() as Promise<T>; } }; }
// Source contract bytes: 4079
