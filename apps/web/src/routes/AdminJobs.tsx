import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel, StatusBadge } from '../components/shared.js';

// Read-only operational oversight — admin can view every job's status here, but the actions
// that change a job (transitions, findings, completion) live on the Repair Room page itself,
// gated to the mechanic role there. Richer dispatch/assignment policy is still pending (see
// docs/integration-status.md "Admin/mechanic workflows" row) — this is the list, not a full
// operations console.
export function AdminJobs({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const jobs = useQuery({ queryKey: ['admin-jobs', actorKey], queryFn: () => api.listAdminJobs() });
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  return (
    <section aria-labelledby="admin-jobs-heading">
      <h1
        id="admin-jobs-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Admin &mdash; Jobs
      </h1>

      <p>
        Issue a quote for a service request: <Link to="/admin/quotes/new">New quote</Link>
      </p>

      {jobs.isPending && <p role="status">Loading jobs&hellip;</p>}
      {jobs.isError && <ErrorPanel error={jobs.error} onRetry={() => jobs.refetch()} />}
      {jobs.data && jobs.data.data.length === 0 && <p className="pending-note">No jobs yet.</p>}
      {jobs.data && jobs.data.data.length > 0 && (
        <ul className="vehicle-list">
          {jobs.data.data.map((job, index) => (
            <li key={job.id}>
              <Link to={`/jobs/${job.id}`} className="vehicle-card" style={{ animationDelay: `${index * 0.08}s` }}>
                <div className="job-card-info">
                  <strong>Job {job.id.slice(0, 8)}&hellip;</strong>
                  {job.createdAt && <span className="job-card-date">Booked {new Date(job.createdAt).toLocaleDateString()}</span>}
                </div>
                <StatusBadge status={job.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
