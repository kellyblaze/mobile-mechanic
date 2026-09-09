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
// here directly still works (React Query fetches the list fresh). Service history is honestly
// marked pending (GET /vehicles/{id}/history isn't published — see CR-003) rather than showing
// fabricated records.
export function VehiclePassport({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id } = useParams();
  const vehicles = useQuery({ queryKey: ['vehicles', actorKey], queryFn: () => api.listVehicles() });
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
      <p className="pending-note">
        Service history isn&rsquo;t published in the API contract yet (see docs/change-requests/CR-003.md) —
        this section will show real inspection, repair, and warranty records once{' '}
        <code>GET /vehicles/{'{id}'}/history</code> ships. Nothing here is fabricated in the meantime.
      </p>
    </section>
  );
}
