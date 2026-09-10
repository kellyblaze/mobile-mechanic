import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ActorKey } from '../lib/devActors.js';
import { fetchMonitoringIssues, type MonitoringIssueFilters } from '../lib/monitoringMockData.js';
import { useInViewOnce } from '../hooks.js';
import { AdminOnlyGate, ErrorPanel, MockModeBanner, StatusBadge } from '../components/shared.js';

export function MonitoringIssues({ actorKey }: { actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [filters, setFilters] = useState<MonitoringIssueFilters>({});
  const [simulateFailure, setSimulateFailure] = useState(false);
  const issues = useQuery({
    queryKey: ['monitoring-issues', filters, simulateFailure],
    queryFn: () => fetchMonitoringIssues(filters, simulateFailure)
  });

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

        <MockModeBanner />

        <form
          className="intake-step"
          onSubmit={(event) => event.preventDefault()}
        >
          <label>
            Severity
            <select
              value={filters.severity ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, severity: (event.target.value || undefined) as MonitoringIssueFilters['severity'] }))}
            >
              <option value="">Any</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, status: (event.target.value || undefined) as MonitoringIssueFilters['status'] }))}
            >
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </label>
          <label>
            Environment
            <select
              value={filters.environment ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, environment: event.target.value || undefined }))}
            >
              <option value="">Any</option>
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
          </label>
          <button type="button" onClick={() => setSimulateFailure((current) => !current)}>
            {simulateFailure ? 'Stop simulating a failure' : 'Simulate a failure (mock mode)'}
          </button>
        </form>

        {issues.isPending && <p role="status">Loading issues&hellip;</p>}
        {issues.isError && <ErrorPanel error={issues.error} onRetry={() => issues.refetch()} />}
        {issues.data && issues.data.data.length === 0 && <p className="pending-note">No issues match these filters.</p>}
        {issues.data && issues.data.data.length > 0 && (
          <ul className="vehicle-list">
            {issues.data.data.map((issue, index) => (
              <li key={issue.id}>
                <Link to={`/admin/monitoring/issues/${issue.id}`} className="vehicle-card" style={{ animationDelay: `${index * 0.08}s` }}>
                  <div className="job-card-info">
                    <strong>{issue.title}</strong>
                    <span className="job-card-date">
                      {issue.environment}
                      {issue.release ? ` · ${issue.release}` : ''} · {issue.count}&times; · last seen {new Date(issue.lastSeenAt).toLocaleString()}
                    </span>
                  </div>
                  <StatusBadge status={issue.severity} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminOnlyGate>
  );
}
