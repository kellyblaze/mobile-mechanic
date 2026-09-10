import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringIssueDetail } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner, StatusBadge } from '../components/shared.js';

export function MonitoringIssueDetail({ actorKey }: { actorKey: ActorKey }) {
  const { id } = useParams();
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [simulateFailure, setSimulateFailure] = useState(false);
  const issue = useQuery({
    queryKey: ['monitoring-issue', id, simulateFailure],
    queryFn: () => fetchMonitoringIssueDetail(id as string, simulateFailure),
    enabled: Boolean(id)
  });

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

        <MockModeBanner />

        <p>
          <button type="button" onClick={() => setSimulateFailure((current) => !current)}>
            {simulateFailure ? 'Stop simulating a failure' : 'Simulate a failure (mock mode)'}
          </button>
        </p>

        {issue.isPending && <p role="status">Loading issue&hellip;</p>}
        {issue.isError && <ErrorPanel error={issue.error} onRetry={() => issue.refetch()} />}

        {issue.data === null && (
          <section aria-labelledby="monitoring-issue-not-found-heading">
            <h2 id="monitoring-issue-not-found-heading" className="visually-hidden">Issue not found</h2>
            <p>This issue doesn&rsquo;t exist, or the mock fixture doesn&rsquo;t include it.</p>
          </section>
        )}

        {issue.data && (
          <>
            <p>
              <StatusBadge status={issue.data.severity} /> <StatusBadge status={issue.data.status} />
            </p>
            <ul className="service-list">
              <li className="service-card">
                <strong>Message</strong>
                <span>{issue.data.message}</span>
              </li>
              <li className="service-card">
                <strong>Route</strong>
                <span>{issue.data.route}</span>
              </li>
              <li className="service-card">
                <strong>Environment</strong>
                <span>
                  {issue.data.environment}
                  {issue.data.release ? ` · ${issue.data.release}` : ''}
                </span>
              </li>
              <li className="service-card">
                <strong>Occurrences</strong>
                <span>
                  {issue.data.count} &mdash; first seen {new Date(issue.data.firstSeenAt).toLocaleString()}, last seen{' '}
                  {new Date(issue.data.lastSeenAt).toLocaleString()}
                </span>
              </li>
            </ul>

            <h2>Stack trace summary</h2>
            <p className="pending-note">
              Customer-identifying fields are shown redacted here, matching how a real proxy
              response must already redact them server-side — the frontend never receives the
              real values (see CR-014).
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{issue.data.stackSummary.join('\n')}</pre>
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
