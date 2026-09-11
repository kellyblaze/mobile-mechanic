// MOCK MODE — for local development only, per docs/handoffs/2026-09-10-monitoring-proxy-claude.md
// ("Keep an explicit mock mode available for local development when the API provider is
// unavailable"). The real proxy is live (CR-014, contract 1.9.0) and is the default in every
// Monitoring* route; this file only exists as an opt-in fallback, and every screen labels which
// mode is active. Reuses the exact real types from apiAdapter.ts (not a parallel shape) so mock
// and real data render through identical UI code with no branching.
//
// A deliberately fake network delay + an opt-in "simulate a failure" flag let the loading/error/
// retry states be exercised on demand even when the real API is healthy.
import type {
  MonitoringOverview,
  MonitoringIssueSummary,
  MonitoringIssueDetail,
  MonitoringIssuesPage,
  MonitoringIssueFilters,
  MonitoringWebhookStatus,
  MonitoringReconciliation,
  MonitoringUptime
} from './apiAdapter.js';

const NETWORK_DELAY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

function maybeSimulateFailure(simulateFailure: boolean): void {
  if (simulateFailure) throw new Error('Simulated monitoring proxy failure (mock mode) — this is not a real outage.');
}

// checkedAt is deliberately 12 minutes in the past (not "now") so the overview's stale-data
// warning threshold (5 minutes) genuinely fires in mock mode, rather than only in theory.
const MOCK_CHECKED_AT = new Date(Date.now() - 12 * 60 * 1000).toISOString();

export async function fetchMonitoringOverview(simulateFailure = false): Promise<MonitoringOverview> {
  maybeSimulateFailure(simulateFailure);
  return delay({
    environment: 'development',
    release: 'local',
    api: { status: 'healthy', checkedAt: MOCK_CHECKED_AT },
    // Real values here are hardcoded to 0 server-side too (not yet wired to GlitchTip) — this
    // mock shows non-zero numbers specifically so the UI's rendering of them is exercised at all.
    issues: { open: 4, critical: 1, last24Hours: 2 },
    webhooks: { failed: 1, oldestPendingAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
    reconciliation: { unpaidSucceededPayments: 1, oldestLagMinutes: 22 }
  });
}

const MOCK_ISSUES: MonitoringIssueSummary[] = [
  { id: 'iss-1', title: 'Stripe webhook signature verification failed', severity: 'error', status: 'unresolved', environment: 'production', release: 'v1.9.0', count: 3, lastSeenAt: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { id: 'iss-2', title: 'Booking hold confirm returned 500', severity: 'warning', status: 'resolved', environment: 'development', release: 'local', count: 1, lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-3', title: 'Quote acceptance version conflict spike', severity: 'warning', status: 'unresolved', environment: 'production', release: 'v1.9.0', count: 14, lastSeenAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-4', title: 'Vehicle history query timeout', severity: 'warning', status: 'unresolved', environment: 'production', release: 'v1.6.0', count: 2, lastSeenAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-5', title: 'Upload initiation rate-limited', severity: 'info', status: 'ignored', environment: 'production', release: 'v1.9.0', count: 8, lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
];

export async function fetchMonitoringIssues(filters: MonitoringIssueFilters, simulateFailure = false): Promise<MonitoringIssuesPage> {
  maybeSimulateFailure(simulateFailure);
  const filtered = MOCK_ISSUES.filter(
    (issue) =>
      (!filters.severity || issue.severity === filters.severity) &&
      (!filters.status || issue.status === filters.status) &&
      (!filters.environment || issue.environment === filters.environment) &&
      (!filters.release || issue.release === filters.release)
  );
  // Matches the real endpoint's current behavior (nextCursor is always null there too — no
  // working multi-page pagination server-side yet) rather than pretending mock mode has more.
  return delay({ data: filtered, nextCursor: null });
}

export async function fetchMonitoringIssueDetail(id: string, simulateFailure = false): Promise<MonitoringIssueDetail | null> {
  maybeSimulateFailure(simulateFailure);
  const summary = MOCK_ISSUES.find((issue) => issue.id === id);
  if (!summary) return delay(null);
  // The real detail endpoint passes through GlitchTip's own object shape with no field mapping,
  // redacted by key-name pattern (dsn/secret/token/email/phone/vin/payment/etc.) — this mirrors
  // that same shape and redaction, not MonitoringIssueSummary's normalized fields.
  return delay({
    id: summary.id,
    title: summary.title,
    status: summary.status,
    level: summary.severity,
    environment: summary.environment,
    release: summary.release,
    count: summary.count,
    lastSeen: summary.lastSeenAt,
    firstSeen: new Date(new Date(summary.lastSeenAt as string).getTime() - 6 * 60 * 60 * 1000).toISOString(),
    culprit: 'POST /api/v1/payments',
    metadata: { customerEmail: '[REDACTED]', paymentIntentId: '[REDACTED]' }
  });
}

export async function fetchMonitoringWebhooks(simulateFailure = false): Promise<MonitoringWebhookStatus> {
  maybeSimulateFailure(simulateFailure);
  return delay({ failed: 1, oldestPendingAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() });
}

export async function fetchMonitoringReconciliation(simulateFailure = false): Promise<MonitoringReconciliation> {
  maybeSimulateFailure(simulateFailure);
  return delay({ unpaidSucceededPayments: 1, oldestLagMinutes: 22 });
}

export async function fetchMonitoringUptime(simulateFailure = false): Promise<MonitoringUptime> {
  maybeSimulateFailure(simulateFailure);
  return delay({ api: { status: 'healthy', checkedAt: new Date(Date.now() - 60 * 1000).toISOString() } });
}
