import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringOperations } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner, StatusBadge } from '../components/shared.js';

export function MonitoringOperations({ actorKey }: { actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [simulateFailure, setSimulateFailure] = useState(false);
  const operations = useQuery({
    queryKey: ['monitoring-operations', simulateFailure],
    queryFn: () => fetchMonitoringOperations(simulateFailure)
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

        <MockModeBanner />

        <p>
          <button type="button" onClick={() => setSimulateFailure((current) => !current)}>
            {simulateFailure ? 'Stop simulating a failure' : 'Simulate a failure (mock mode)'}
          </button>
        </p>

        {operations.isPending && <p role="status">Loading operations&hellip;</p>}
        {operations.isError && <ErrorPanel error={operations.error} onRetry={() => operations.refetch()} />}

        {operations.data && (
          <>
            <h2>Webhook delivery</h2>
            <ul className="service-list">
              {operations.data.webhooks.map((webhook) => (
                <li key={webhook.provider} className="service-card">
                  <strong>{webhook.provider}</strong>
                  <span>
                    {webhook.failed24Hours} failed (24h)
                    {webhook.oldestPendingAt ? ` · oldest pending ${new Date(webhook.oldestPendingAt).toLocaleString()}` : ''}
                  </span>
                </li>
              ))}
            </ul>

            <h2>Payment reconciliation</h2>
            <p>
              {operations.data.reconciliation.unpaidSucceededPayments} succeeded payment(s) not yet reconciled to an invoice
              {operations.data.reconciliation.oldestLagMinutes ? ` · oldest lag ${operations.data.reconciliation.oldestLagMinutes} min` : ''}.
            </p>

            <h2>Uptime</h2>
            <ul className="service-list">
              {operations.data.uptime.map((check) => (
                <li key={check.name} className="service-card">
                  <strong>{check.name}</strong>
                  <span>
                    <StatusBadge status={check.status} /> &middot; {check.uptimePercent30Days}% (30d) &middot; checked{' '}
                    {new Date(check.lastCheckedAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
