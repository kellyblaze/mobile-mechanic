import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringWebhooks, fetchMonitoringReconciliation, fetchMonitoringUptime } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner, StatusBadge } from '../components/shared.js';

export function MonitoringOperations({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [useMockData, setUseMockData] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  const simulateOrFetch = <T,>(mockFn: () => Promise<T>, realFn: () => Promise<T>) => {
    if (simulateError) throw new Error('Simulated server error (test only) — not a real outage.');
    return useMockData ? mockFn() : realFn();
  };

  const webhooks = useQuery({
    queryKey: ['monitoring-webhooks', actorKey, useMockData, simulateError],
    queryFn: () => simulateOrFetch(fetchMonitoringWebhooks, () => api.getMonitoringWebhooks().then((response) => response.data))
  });
  const reconciliation = useQuery({
    queryKey: ['monitoring-reconciliation', actorKey, useMockData, simulateError],
    queryFn: () => simulateOrFetch(fetchMonitoringReconciliation, () => api.getMonitoringReconciliation().then((response) => response.data))
  });
  const uptime = useQuery({
    queryKey: ['monitoring-uptime', actorKey, useMockData, simulateError],
    queryFn: () => simulateOrFetch(fetchMonitoringUptime, () => api.getMonitoringUptime().then((response) => response.data))
  });

  return (
    <AdminOnlyGate actorKey={actorKey}>
      <section aria-labelledby="monitoring-operations-heading">
        <Link to="/admin/monitoring">&larr; Back to Monitoring</Link>
        <h1
          id="monitoring-operations-heading"
          ref={headingRef}
          className={`page-heading${headingInView ? ' is-in-view' : ''}`}
        >
          Operations
        </h1>

        {useMockData && <MockModeBanner />}

        <p>
          <label>
            <input type="checkbox" checked={useMockData} onChange={(event) => setUseMockData(event.target.checked)} /> Use mock
            data (dev only)
          </label>
          {' · '}
          <button type="button" onClick={() => setSimulateError((current) => !current)}>
            {simulateError ? 'Stop simulating an error' : 'Simulate a server error (test only)'}
          </button>
        </p>

        <h2>Webhook delivery</h2>
        {webhooks.isPending && <p role="status">Loading&hellip;</p>}
        {webhooks.isError && <ErrorPanel error={webhooks.error} onRetry={() => webhooks.refetch()} />}
        {webhooks.data && (
          <p>
            {webhooks.data.failed} failed
            {webhooks.data.oldestPendingAt ? ` · oldest pending ${new Date(webhooks.data.oldestPendingAt).toLocaleString()}` : ''}
          </p>
        )}

        <h2>Payment reconciliation</h2>
        {reconciliation.isPending && <p role="status">Loading&hellip;</p>}
        {reconciliation.isError && <ErrorPanel error={reconciliation.error} onRetry={() => reconciliation.refetch()} />}
        {reconciliation.data && (
          <p>
            {reconciliation.data.unpaidSucceededPayments} succeeded payment(s) not yet reconciled to an invoice
            {reconciliation.data.oldestLagMinutes ? ` · oldest lag ${reconciliation.data.oldestLagMinutes} min` : ''}.
          </p>
        )}

        <h2>Uptime</h2>
        {uptime.isPending && <p role="status">Loading&hellip;</p>}
        {uptime.isError && <ErrorPanel error={uptime.error} onRetry={() => uptime.refetch()} />}
        {uptime.data && (
          <p>
            <StatusBadge status={uptime.data.api.status} /> &middot; checked {new Date(uptime.data.api.checkedAt).toLocaleTimeString()}
          </p>
        )}
      </section>
    </AdminOnlyGate>
  );
}
