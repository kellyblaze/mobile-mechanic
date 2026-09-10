// MOCK MODE — CR-014 filed (docs/change-requests/CR-014.md). There is no
// /admin/monitoring/* proxy in the contract yet (grepped the whole repo: no route, no schema),
// and the frontend must never call GlitchTip directly from the browser with an org token. Every
// function here returns synthetic, hand-written data — nothing here reads or forwards anything
// real. Once Codex publishes the real endpoints, these get replaced by real apiAdapter methods
// with the same shapes; every Monitoring* route already renders a visible "MOCK MODE" notice so
// removing that notice is the only UI change needed at that point.
//
// A deliberately fake network delay + an opt-in "simulate a failure" flag let the loading/error/
// retry states actually be exercised live in mock mode, rather than only existing in unreachable
// code — matching the review checklist in the handoff doc.

export type MonitoringSummary = {
  environment: string;
  release?: string;
  api: { status: 'healthy' | 'degraded' | 'down'; checkedAt: string };
  issues: { open: number; critical: number; last24Hours: number };
  webhooks: { failed: number; oldestPendingAt?: string };
  reconciliation: { unpaidSucceededPayments: number; oldestLagMinutes?: number };
  booking: { conflicts24Hours: number };
};

export type MonitoringIssueSeverity = 'critical' | 'error' | 'warning';
export type MonitoringIssueStatus = 'open' | 'resolved' | 'ignored';

export type MonitoringIssueSummary = {
  id: string;
  title: string;
  severity: MonitoringIssueSeverity;
  status: MonitoringIssueStatus;
  environment: string;
  release?: string;
  count: number;
  lastSeenAt: string;
};

export type MonitoringIssueDetail = MonitoringIssueSummary & {
  message: string;
  route: string;
  firstSeenAt: string;
  // A masked stand-in for a stack trace, not a real one — real detail payloads must redact
  // customer-identifying fields server-side per the handoff's security requirements; this mock
  // shows the same shape a real, already-redacted response would have.
  stackSummary: string[];
};

export type MonitoringWebhookStatus = {
  provider: string;
  failed24Hours: number;
  oldestPendingAt?: string;
  lastDeliveredAt?: string;
};

export type MonitoringUptimeCheck = {
  name: string;
  status: 'up' | 'down';
  lastCheckedAt: string;
  uptimePercent30Days: number;
};

export type MonitoringOperations = {
  webhooks: MonitoringWebhookStatus[];
  reconciliation: { unpaidSucceededPayments: number; oldestLagMinutes?: number };
  uptime: MonitoringUptimeCheck[];
};

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

export async function fetchMonitoringOverview(simulateFailure = false): Promise<MonitoringSummary> {
  maybeSimulateFailure(simulateFailure);
  return delay({
    environment: 'development',
    release: 'local',
    api: { status: 'healthy', checkedAt: MOCK_CHECKED_AT },
    issues: { open: 4, critical: 1, last24Hours: 2 },
    webhooks: { failed: 1, oldestPendingAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
    reconciliation: { unpaidSucceededPayments: 1, oldestLagMinutes: 22 },
    booking: { conflicts24Hours: 0 }
  });
}

const MOCK_ISSUES: MonitoringIssueSummary[] = [
  { id: 'iss-1', title: 'Stripe webhook signature verification failed', severity: 'critical', status: 'open', environment: 'production', release: 'v1.7.0', count: 3, lastSeenAt: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { id: 'iss-2', title: 'Booking hold confirm returned 500', severity: 'error', status: 'resolved', environment: 'development', release: 'local', count: 1, lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-3', title: 'Quote acceptance version conflict spike', severity: 'warning', status: 'open', environment: 'production', release: 'v1.7.0', count: 14, lastSeenAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-4', title: 'Vehicle history query timeout', severity: 'error', status: 'open', environment: 'production', release: 'v1.6.0', count: 2, lastSeenAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
  { id: 'iss-5', title: 'Upload initiation rate-limited', severity: 'warning', status: 'ignored', environment: 'production', release: 'v1.7.0', count: 8, lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
];

export type MonitoringIssueFilters = {
  severity?: MonitoringIssueSeverity;
  status?: MonitoringIssueStatus;
  environment?: string;
  release?: string;
};

export async function fetchMonitoringIssues(
  filters: MonitoringIssueFilters,
  simulateFailure = false
): Promise<{ data: MonitoringIssueSummary[] }> {
  maybeSimulateFailure(simulateFailure);
  const filtered = MOCK_ISSUES.filter(
    (issue) =>
      (!filters.severity || issue.severity === filters.severity) &&
      (!filters.status || issue.status === filters.status) &&
      (!filters.environment || issue.environment === filters.environment) &&
      (!filters.release || issue.release === filters.release)
  );
  return delay({ data: filtered });
}

export async function fetchMonitoringIssueDetail(id: string, simulateFailure = false): Promise<MonitoringIssueDetail | null> {
  maybeSimulateFailure(simulateFailure);
  const summary = MOCK_ISSUES.find((issue) => issue.id === id);
  if (!summary) return delay(null);
  return delay({
    ...summary,
    message: `${summary.title} — recurring in ${summary.environment}.`,
    route: 'POST /api/v1/payments',
    firstSeenAt: new Date(new Date(summary.lastSeenAt).getTime() - 6 * 60 * 60 * 1000).toISOString(),
    // Customer-identifying fields shown as already-redacted, matching what a real proxy response
    // must do server-side — the frontend never receives the real values to redact itself.
    stackSummary: [
      'at processPayment (payments/service.ts:142)',
      'at Stripe.PaymentIntents.create (stripe-node/lib/resources/PaymentIntents.ts:58)',
      'customerEmail: [redacted], paymentIntentId: [redacted]'
    ]
  });
}

export async function fetchMonitoringOperations(simulateFailure = false): Promise<MonitoringOperations> {
  maybeSimulateFailure(simulateFailure);
  return delay({
    webhooks: [
      { provider: 'stripe', failed24Hours: 1, oldestPendingAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), lastDeliveredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
      { provider: 'supabase-auth-sync', failed24Hours: 0, lastDeliveredAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() }
    ],
    reconciliation: { unpaidSucceededPayments: 1, oldestLagMinutes: 22 },
    uptime: [
      { name: 'API (production)', status: 'up', lastCheckedAt: new Date(Date.now() - 60 * 1000).toISOString(), uptimePercent30Days: 99.94 },
      { name: 'Web app (production)', status: 'up', lastCheckedAt: new Date(Date.now() - 90 * 1000).toISOString(), uptimePercent30Days: 99.98 }
    ]
  });
}
