import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringOverview } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner } from '../components/shared.js';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function MonitoringOverview({ actorKey }: { actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [simulateFailure, setSimulateFailure] = useState(false);
  const overview = useQuery({
    queryKey: ['monitoring-overview', simulateFailure],
    queryFn: () => fetchMonitoringOverview(simulateFailure)
  });

  return (
    <AdminOnlyGate actorKey={actorKey}>
      <section aria-labelledby="monitoring-overview-heading">
        <h1
          id="monitoring-overview-heading"
          ref={headingRef}
          className={`page-heading${headingInView ? ' is-in-view' : ''}`}
        >
          Monitoring
        </h1>

        <MockModeBanner />

        <p>
          <Link to="/admin/monitoring/issues">Issues</Link>
          {' · '}
          <Link to="/admin/monitoring/operations">Operations</Link>
          {' · '}
          <button type="button" onClick={() => setSimulateFailure((current) => !current)}>
            {simulateFailure ? 'Stop simulating a failure' : 'Simulate a failure (mock mode)'}
          </button>
        </p>

        {overview.isPending && <p role="status">Loading overview&hellip;</p>}
        {overview.isError && <ErrorPanel error={overview.error} onRetry={() => overview.refetch()} />}

        {overview.data && (
          <>
            {Date.now() - new Date(overview.data.api.checkedAt).getTime() > STALE_THRESHOLD_MS && (
              <p role="alert" className="field-errors">
                This data is stale &mdash; last checked {new Date(overview.data.api.checkedAt).toLocaleTimeString()}.
              </p>
            )}
            <ul className="service-list">
              <li className="service-card">
                <strong>Environment</strong>
                <span>
                  {overview.data.environment}
                  {overview.data.release ? ` (${overview.data.release})` : ''}
                </span>
              </li>
              <li className="service-card">
                <strong>API status</strong>
                <span>{overview.data.api.status}</span>
              </li>
              <li className="service-card">
                <strong>Open issues</strong>
                <span>
                  {overview.data.issues.open} ({overview.data.issues.critical} critical, {overview.data.issues.last24Hours} in last 24h)
                </span>
              </li>
              <li className="service-card">
                <strong>Webhook failures</strong>
                <span>{overview.data.webhooks.failed}</span>
              </li>
              <li className="service-card">
                <strong>Unreconciled payments</strong>
                <span>{overview.data.reconciliation.unpaidSucceededPayments}</span>
              </li>
              <li className="service-card">
                <strong>Booking conflicts (24h)</strong>
                <span>{overview.data.booking.conflicts24Hours}</span>
              </li>
            </ul>
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
