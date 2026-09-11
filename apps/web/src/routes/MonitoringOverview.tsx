import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringOverview } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner } from '../components/shared.js';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function MonitoringOverview({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [useMockData, setUseMockData] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const overview = useQuery({
    queryKey: ['monitoring-overview', actorKey, useMockData, simulateError],
    queryFn: () => {
      if (simulateError) throw new Error('Simulated server error (test only) — not a real outage.');
      return useMockData ? fetchMonitoringOverview() : api.getMonitoringOverview().then((response) => response.data);
    }
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

        {useMockData && <MockModeBanner />}

        <p>
          <Link to="/admin/monitoring/issues">Issues</Link>
          {' · '}
          <Link to="/admin/monitoring/operations">Operations</Link>
        </p>
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
            </ul>
            {!useMockData && overview.data.issues.open === 0 && overview.data.issues.critical === 0 && overview.data.issues.last24Hours === 0 && (
              <p className="pending-note">
                Issue counts are not wired to GlitchTip yet on the backend &mdash; these are
                always 0 regardless of real issue volume. See{' '}
                <Link to="/admin/monitoring/issues">Issues</Link> for real (or 503-unavailable)
                issue data.
              </p>
            )}
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
