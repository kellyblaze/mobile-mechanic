import { useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, createApiAdapter, type ApiAdapter, type DevActor } from './lib/apiAdapter.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:3000/api/v1';

const DEV_ACTORS = {
  customer: { userId: 'customer-demo', role: 'customer' },
  mechanic: { userId: 'mechanic-demo', role: 'mechanic' },
  admin: { userId: 'admin-demo', role: 'admin' }
} satisfies Record<string, DevActor>;

type ActorKey = keyof typeof DEV_ACTORS;

export default function App() {
  const [actorKey, setActorKey] = useState<ActorKey>('customer');
  const api = useMemo(() => createApiAdapter({ baseUrl: API_BASE_URL, actor: DEV_ACTORS[actorKey] }), [actorKey]);

  return (
    <div className="app-shell">
      <DevSessionBar actorKey={actorKey} onChange={setActorKey} />
      <header className="app-header">
        <Link to="/" className="brand">Your Personal Garage</Link>
        <nav aria-label="Primary">
          <Link to="/vehicles">My Garage</Link>
          <Link to="/jobs/job-1">Repair Room</Link>
        </nav>
      </header>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home api={api} />} />
          <Route path="/vehicles" element={<Vehicles api={api} />} />
          <Route path="/jobs/:id" element={<RepairRoom api={api} />} />
        </Routes>
      </main>
    </div>
  );
}

function DevSessionBar({ actorKey, onChange }: { actorKey: ActorKey; onChange: (key: ActorKey) => void }) {
  return (
    <div className="dev-session-bar" role="note">
      <span>Development session (not a real login):</span>
      <label>
        <span className="visually-hidden">Development role</span>
        <select value={actorKey} onChange={(event) => onChange(event.target.value as ActorKey)}>
          <option value="customer">customer-demo</option>
          <option value="mechanic">mechanic-demo</option>
          <option value="admin">admin-demo</option>
        </select>
      </label>
    </div>
  );
}

function Home({ api }: { api: ApiAdapter }) {
  const catalog = useQuery({ queryKey: ['service-catalog'], queryFn: () => api.listServiceCatalog() });

  const entryDoors = [
    { label: "Something's wrong", description: 'Tell us the symptom and get routed to a diagnostic or repair.' },
    { label: 'Tires & maintenance', description: 'Book tire replacement or routine service.' },
    { label: 'Bodywork & paint', description: 'Start a body/paint consultation.' }
  ];

  return (
    <section className="home">
      <div className="hero">
        <h1>Tell us what&rsquo;s wrong. See the plan. Approve the price. Follow the repair.</h1>
        <p>Every path below starts with your vehicle.</p>
      </div>
      <div className="entry-doors">
        {entryDoors.map((door) => (
          <Link key={door.label} to="/vehicles" className="entry-door">
            <h2>{door.label}</h2>
            <p>{door.description}</p>
          </Link>
        ))}
      </div>
      <section aria-labelledby="catalog-heading">
        <h2 id="catalog-heading">What we offer</h2>
        {catalog.isPending && <p role="status">Loading services&hellip;</p>}
        {catalog.isError && <ErrorPanel error={catalog.error} onRetry={() => catalog.refetch()} />}
        {catalog.data && catalog.data.data.length === 0 && <p>No services are published yet.</p>}
        {catalog.data && catalog.data.data.length > 0 && (
          <ul className="service-list">
            {catalog.data.data.map((service) => (
              <li key={service.id} className="service-card">
                <strong>{service.name}</strong>
                <span>{service.delivery.join(' / ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Vehicles({ api }: { api: ApiAdapter }) {
  const queryClient = useQueryClient();
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api.listVehicles() });
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
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    }
  });

  return (
    <section aria-labelledby="garage-heading">
      <h1 id="garage-heading">My Garage</h1>

      {vehicles.isPending && <p role="status">Loading your vehicles&hellip;</p>}
      {vehicles.isError && <ErrorPanel error={vehicles.error} onRetry={() => vehicles.refetch()} />}
      {vehicles.data && vehicles.data.data.length === 0 && <p>No vehicles yet &mdash; add your first one below.</p>}
      {vehicles.data && vehicles.data.data.length > 0 && (
        <ul className="vehicle-list">
          {vehicles.data.data.map((vehicle) => (
            <li key={vehicle.id} className="vehicle-card">
              <strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong>
              {typeof vehicle.mileage === 'number' && <span>{vehicle.mileage.toLocaleString()} mi</span>}
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
          {createVehicle.isPending ? 'Adding&hellip;' : 'Add vehicle'}
        </button>
        {createVehicle.isError && <ValidationErrors error={createVehicle.error} />}
      </form>
    </section>
  );
}

function RepairRoom({ api }: { api: ApiAdapter }) {
  const { id = 'job-1' } = useParams();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ['job', id], queryFn: () => api.getJob(id) });

  const acceptQuote = useMutation({
    mutationFn: (input: { quoteId: string; expectedVersion: number }) =>
      api.acceptQuote(input.quoteId, { expectedVersion: input.expectedVersion, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job', id] })
  });

  if (job.isPending) return <p role="status">Loading Repair Room&hellip;</p>;
  if (job.isError) return <ErrorPanel error={job.error} onRetry={() => job.refetch()} />;

  const record = job.data.data;

  return (
    <section aria-labelledby="repair-room-heading">
      <h1 id="repair-room-heading">Repair Room</h1>
      <p>
        Status: <StatusBadge status={record.status} /> &middot; version {record.version}
      </p>
      <p>Allowed actions: {record.allowedActions.length ? record.allowedActions.join(', ') : 'none yet'}</p>

      {record.allowedActions.includes('approve_change_order') && (
        <button
          onClick={() => acceptQuote.mutate({ quoteId: 'quote-1', expectedVersion: 1 })}
          disabled={acceptQuote.isPending}
        >
          {acceptQuote.isPending ? 'Approving&hellip;' : 'Approve pending quote (quote-1)'}
        </button>
      )}
      {acceptQuote.isError && <ValidationErrors error={acceptQuote.error} />}
      {acceptQuote.isSuccess && (
        <p role="status">Quote accepted &mdash; total ${(acceptQuote.data.data.totalMinor / 100).toFixed(2)}.</p>
      )}

      <p className="pending-note">
        Messages, inspection findings, change orders, completion reports, and invoices are not yet published in the
        API contract. Those sections will appear here once their endpoints ship (see docs/integration-status.md).
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status.replace(/_/g, ' ')}</span>;
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiRequestError ? error.message : 'Something went wrong loading this.';
  return (
    <div role="alert" className="error-panel">
      <p>{message}</p>
      <button onClick={onRetry}>Try again</button>
    </div>
  );
}

function ValidationErrors({ error }: { error: unknown }) {
  if (!(error instanceof ApiRequestError)) {
    return <p role="alert">Something went wrong. Please try again.</p>;
  }
  if (error.status === 409) {
    return <p role="alert">{error.message} Refresh to get the latest version.</p>;
  }
  if (error.fieldErrors) {
    return (
      <ul role="alert" className="field-errors">
        {Object.entries(error.fieldErrors).map(([field, messages]) => (
          <li key={field}>
            {field}: {messages.join(', ')}
          </li>
        ))}
      </ul>
    );
  }
  return <p role="alert">{error.message}</p>;
}
