import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel, ValidationErrors } from '../components/shared.js';

export function Vehicles({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const queryClient = useQueryClient();
  // actorKey is part of the query key (not just an api closure dependency) so switching the
  // dev-session role refetches instead of silently reusing another actor's cached data/error.
  const vehicles = useQuery({ queryKey: ['vehicles', actorKey], queryFn: () => api.listVehicles() });
  const [form, setForm] = useState({ year: '', make: '', model: '', mileage: '' });

  const createVehicle = useMutation({
    mutationFn: () =>
      api.createVehicle({
        year: Number(form.year),
        make: form.make,
        model: form.model,
        mileage: form.mileage ? Number(form.mileage) : undefined
      }),
    onSuccess: () => {
      setForm({ year: '', make: '', model: '', mileage: '' });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', actorKey] });
    }
  });

  return (
    <section aria-labelledby="garage-heading">
      <h1 id="garage-heading" ref={headingRef} className={`page-heading${headingInView ? ' is-in-view' : ''}`}>
        My Garage
      </h1>

      {vehicles.isPending && <p role="status">Loading your vehicles&hellip;</p>}
      {vehicles.isError && <ErrorPanel error={vehicles.error} onRetry={() => vehicles.refetch()} />}
      {vehicles.data && vehicles.data.data.length === 0 && <p>No vehicles yet &mdash; add your first one below.</p>}
      {vehicles.data && vehicles.data.data.length > 0 && (
        <ul className="vehicle-list">
          {vehicles.data.data.map((vehicle, index) => (
            <li key={vehicle.id}>
              <Link to={`/vehicles/${vehicle.id}`} className="vehicle-card" style={{ animationDelay: `${index * 0.08}s` }}>
                <strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong>
                {typeof vehicle.mileage === 'number' && <span>{vehicle.mileage.toLocaleString()} mi</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          createVehicle.mutate();
        }}
        aria-labelledby="add-vehicle-heading"
      >
        <h2 id="add-vehicle-heading">Add a vehicle</h2>
        <label>
          Year
          <input required inputMode="numeric" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
        </label>
        <label>
          Make
          <input required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
        </label>
        <label>
          Model
          <input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
        </label>
        <label>
          Mileage (optional)
          <input inputMode="numeric" value={form.mileage} onChange={(event) => setForm({ ...form, mileage: event.target.value })} />
        </label>
        <button type="submit" disabled={createVehicle.isPending}>
          {createVehicle.isPending ? 'Adding…' : 'Add vehicle'}
        </button>
        {createVehicle.isError && <ValidationErrors error={createVehicle.error} />}
      </form>
    </section>
  );
}
