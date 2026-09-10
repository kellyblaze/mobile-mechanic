import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

// Vehicle Passport detail view. Deliberately reuses the ['vehicles', actorKey] query (same as
// Vehicles) rather than a per-vehicle fetch — there is no GET /vehicles/{id} in the contract,
// only GET /vehicles (list), so this looks the vehicle up client-side from the already-fetched
// list. That also means navigating here from My Garage is instant (shared cache), and landing
// here directly still works (React Query fetches the list fresh). Service history is real now
// (CR-003 resolved — GET /vehicles/{id}/history), fetched unconditionally alongside the vehicle
// list rather than after the not-found early return below, since hooks can't be conditional.
export function VehiclePassport({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id } = useParams();
  const vehicles = useQuery({ queryKey: ['vehicles', actorKey], queryFn: () => api.listVehicles() });
  const history = useQuery({
    queryKey: ['vehicle-history', id, actorKey],
    queryFn: () => api.getVehicleHistory(id as string),
    enabled: Boolean(id)
  });
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  if (vehicles.isPending) return <p role="status">Loading vehicle&hellip;</p>;
  if (vehicles.isError) return <ErrorPanel error={vehicles.error} onRetry={() => vehicles.refetch()} />;

  const vehicle = vehicles.data.data.find((candidate) => candidate.id === id);

  if (!vehicle) {
    return (
      <section aria-labelledby="passport-heading">
        <Link to="/vehicles">&larr; Back to My Garage</Link>
        <h1 id="passport-heading" className="page-heading is-in-view">Vehicle not found</h1>
        <p>This vehicle isn&rsquo;t in your garage, or you don&rsquo;t have access to it.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="passport-heading">
      <Link to="/vehicles">&larr; Back to My Garage</Link>
      <h1
        id="passport-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>

      <ul className="service-list">
        <li className="service-card">
          <strong>Year</strong>
          <span>{vehicle.year}</span>
        </li>
        <li className="service-card">
          <strong>Make</strong>
          <span>{vehicle.make}</span>
        </li>
        <li className="service-card">
          <strong>Model</strong>
          <span>{vehicle.model}</span>
        </li>
        {typeof vehicle.mileage === 'number' && (
          <li className="service-card">
            <strong>Mileage</strong>
            <span>{vehicle.mileage.toLocaleString()} mi</span>
          </li>
        )}
        {vehicle.vin && (
          <li className="service-card">
            <strong>VIN</strong>
            <span>{vehicle.vin}</span>
          </li>
        )}
      </ul>

      <h2>Service history</h2>
      {history.isPending && <p role="status">Loading service history&hellip;</p>}
      {history.isError && <ErrorPanel error={history.error} onRetry={() => history.refetch()} />}
      {history.data && history.data.data.length === 0 && (
        <p className="pending-note">No completed service history yet for this vehicle.</p>
      )}
      {history.data && history.data.data.length > 0 && (
        <ul className="service-list">
          {/* Real field names confirmed live via curl against GET /vehicles/{id}/history:
              {id, category, status, createdAt} — a service-request record, not (yet) a
              completed-job record with a description. description/summary/completedAt/date
              kept as fallbacks in case a future entry shape includes them, per the same
              defensive pattern used for findings/messages elsewhere in this codebase. */}
          {history.data.data.map((entry, index) => (
            <li key={String(entry.id ?? index)} className="service-card">
              <strong>
                {String(
                  entry.description ??
                    entry.summary ??
                    (entry.category ? `${entry.category} (${entry.status ?? 'unknown'})` : 'Service record')
                )}
              </strong>
              <span>
                {(() => {
                  const raw = entry.completedAt ?? entry.date ?? entry.createdAt;
                  if (typeof raw !== 'string') return '';
                  const parsed = new Date(raw);
                  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString();
                })()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
