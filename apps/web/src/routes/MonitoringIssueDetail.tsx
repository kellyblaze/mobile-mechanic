import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { ApiRequestError } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringIssueDetail } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner } from '../components/shared.js';

export function MonitoringIssueDetail({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id } = useParams();
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [useMockData, setUseMockData] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const issue = useQuery({
    queryKey: ['monitoring-issue', actorKey, id, useMockData, simulateError],
    queryFn: () => {
      if (simulateError) throw new Error('Simulated server error (test only) — not a real outage.');
      return useMockData ? fetchMonitoringIssueDetail(id as string) : api.getMonitoringIssue(id as string).then((response) => response.data);
    },
    enabled: Boolean(id)
  });
  const isProviderUnavailable = !useMockData && issue.error instanceof ApiRequestError && issue.error.status === 503;
  // In real mode a missing issue surfaces as a 404 ApiRequestError (the server's catch block
  // converts any GlitchTip fetch failure, including a genuine not-found, into 404) — mock mode
  // instead resolves successfully with a null payload. Both render the same "not found" message.
  const isNotFound = issue.data === null || (!useMockData && issue.error instanceof ApiRequestError && issue.error.status === 404);

  return (
    <AdminOnlyGate actorKey={actorKey}>
      <section aria-labelledby="monitoring-issue-heading">
        <Link to="/admin/monitoring/issues">&larr; Back to Issues</Link>
        <h1
          id="monitoring-issue-heading"
          ref={headingRef}
          className={`page-heading${headingInView ? ' is-in-view' : ''}`}
        >
          Issue detail
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

        {issue.isPending && <p role="status">Loading issue&hellip;</p>}
        {isProviderUnavailable && (
          <p className="pending-note">
            GlitchTip monitoring isn&rsquo;t configured on this server &mdash; issue detail is
            unavailable until it is. Check &ldquo;Use mock data&rdquo; above to preview the UI.
          </p>
        )}
        {isNotFound && (
          <section aria-labelledby="monitoring-issue-not-found-heading">
            <h2 id="monitoring-issue-not-found-heading" className="visually-hidden">Issue not found</h2>
            <p>This issue doesn&rsquo;t exist, or isn&rsquo;t available.</p>
          </section>
        )}
        {issue.isError && !isProviderUnavailable && !isNotFound && <ErrorPanel error={issue.error} onRetry={() => issue.refetch()} />}

        {issue.data && (
          <>
            <h2>Details</h2>
            <p className="pending-note">
              This is GlitchTip&rsquo;s own issue data, redacted server-side (customer-identifying
              fields are replaced with &ldquo;[REDACTED]&rdquo; before this ever reaches the
              browser) and rendered here as plain, escaped text &mdash; never trusted as markup.
            </p>
            <ul className="service-list">
              {Object.entries(issue.data).map(([key, value]) => (
                <li key={key} className="service-card">
                  <strong>{key}</strong>
                  <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
