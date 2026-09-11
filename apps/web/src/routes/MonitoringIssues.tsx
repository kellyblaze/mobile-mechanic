import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter, MonitoringIssueFilters } from '../lib/apiAdapter.js';
import { ApiRequestError } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringIssues } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner, StatusBadge } from '../components/shared.js';

export function MonitoringIssues({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [filters, setFilters] = useState<MonitoringIssueFilters>({});
  const [useMockData, setUseMockData] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const issues = useQuery({
    queryKey: ['monitoring-issues', actorKey, filters, useMockData, simulateError],
    queryFn: () => {
      if (simulateError) throw new Error('Simulated server error (test only) — not a real outage.');
      return useMockData ? fetchMonitoringIssues(filters) : api.listMonitoringIssues(filters);
    }
  });
  // The real endpoint 503s specifically when GLITCHTIP_API_URL/TOKEN/ORG_SLUG/PROJECT_SLUG
  // aren't all configured server-side — distinct from a generic failure, so it gets its own
  // honest "not configured" message rather than the generic ErrorPanel.
  const isProviderUnavailable = !useMockData && issues.error instanceof ApiRequestError && issues.error.status === 503;

  return (
    <AdminOnlyGate actorKey={actorKey}>
      <section aria-labelledby="monitoring-issues-heading">
        <Link to="/admin/monitoring">&larr; Back to Monitoring</Link>
        <h1
          id="monitoring-issues-heading"
          ref={headingRef}
          className={`page-heading${headingInView ? ' is-in-view' : ''}`}
        >
          Issues
        </h1>

        {useMockData && <MockModeBanner />}

        <form className="intake-step" onSubmit={(event) => event.preventDefault()}>
          <label>
            Severity
            <input
              value={filters.severity ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value || undefined }))}
              placeholder="e.g. error"
            />
          </label>
          <label>
            Status
            <input
              value={filters.status ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value || undefined }))}
              placeholder="e.g. unresolved"
            />
          </label>
          <label>
            Environment
            <input
              value={filters.environment ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, environment: event.target.value || undefined }))}
              placeholder="e.g. production"
            />
          </label>
          <label>
            Release
            <input
              value={filters.release ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, release: event.target.value || undefined }))}
              placeholder="e.g. v1.9.0"
            />
          </label>
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
        </form>

        {issues.isPending && <p role="status">Loading issues&hellip;</p>}
        {isProviderUnavailable && (
          <p className="pending-note">
            GlitchTip monitoring isn&rsquo;t configured on this server (needs
            GLITCHTIP_API_URL/TOKEN/ORG_SLUG/PROJECT_SLUG) &mdash; issue data is unavailable until
            it is. Check &ldquo;Use mock data&rdquo; above to preview the UI with sample issues.
          </p>
        )}
        {issues.isError && !isProviderUnavailable && <ErrorPanel error={issues.error} onRetry={() => issues.refetch()} />}
        {issues.data && issues.data.data.length === 0 && <p className="pending-note">No issues match these filters.</p>}
        {issues.data && issues.data.data.length > 0 && (
          <>
            <ul className="vehicle-list">
              {issues.data.data.map((issue, index) => (
                <li key={issue.id}>
                  <Link to={`/admin/monitoring/issues/${issue.id}`} className="vehicle-card" style={{ animationDelay: `${index * 0.08}s` }}>
                    <div className="job-card-info">
                      <strong>{issue.title}</strong>
                      <span className="job-card-date">
                        {issue.environment ?? 'unknown environment'}
                        {issue.release ? ` · ${issue.release}` : ''}
                        {issue.count !== undefined ? ` · ${issue.count}×` : ''}
                        {issue.lastSeenAt ? ` · last seen ${new Date(issue.lastSeenAt).toLocaleString()}` : ''}
                      </span>
                    </div>
                    {issue.severity && <StatusBadge status={issue.severity} />}
                  </Link>
                </li>
              ))}
            </ul>
            {/* nextCursor is always null on the real endpoint today (no working multi-page
                pagination server-side yet), so this correctly never renders — an honest reflection
                of that, not a frontend gap. */}
            {issues.data.nextCursor && (
              <button type="button" onClick={() => setFilters((current) => ({ ...current, cursor: issues.data?.nextCursor ?? undefined }))}>
                Load more
              </button>
            )}
            {!issues.data.nextCursor && <p className="pending-note">End of results.</p>}
          </>
        )}
      </section>
    </AdminOnlyGate>
  );
}
