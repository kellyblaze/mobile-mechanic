import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel, StatusBadge } from '../components/shared.js';

export function MechanicJobs({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const jobs = useQuery({ queryKey: ['mechanic-jobs', actorKey], queryFn: () => api.listMechanicJobs() });
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  return (
    <section aria-labelledby="mechanic-jobs-heading">
      <h1
        id="mechanic-jobs-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        My Jobs
      </h1>

      {jobs.isPending && <p role="status">Loading your jobs&hellip;</p>}
      {jobs.isError && <ErrorPanel error={jobs.error} onRetry={() => jobs.refetch()} />}
      {jobs.data && jobs.data.data.length === 0 && <p>No jobs assigned yet.</p>}
      {jobs.data && jobs.data.data.length > 0 && (
        <ul className="vehicle-list">
          {jobs.data.data.map((job, index) => (
            <li key={job.id}>
              <Link to={`/jobs/${job.id}`} className="vehicle-card" style={{ animationDelay: `${index * 0.08}s` }}>
                <strong>Job {job.id.slice(0, 8)}&hellip;</strong>
                <StatusBadge status={job.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
