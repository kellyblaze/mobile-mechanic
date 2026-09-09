import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, createApiAdapter, type ApiAdapter, type DevActor } from './lib/apiAdapter.js';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = () => setMatches(mediaQueryList.matches);
    onChange();
    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// One color per sentence via --hero-line-1..4 (styles.css), keyed by array index below.
const HERO_LINES = ["Tell us what's wrong.", 'See the plan.', 'Approve the price.', 'Follow the repair.'];

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
      <a href="#main-content" className="skip-link">Skip to content</a>
      <DevSessionBar actorKey={actorKey} onChange={setActorKey} />
      <header className="app-header">
        <Link to="/" className="brand"><span className="accent">&#9679;</span> Travel Automotive</Link>
        <nav aria-label="Primary">
          <Link to="/vehicles">My Garage</Link>
          <Link to="/jobs/job-1">Repair Room</Link>
        </nav>
      </header>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home api={api} />} />
          <Route path="/vehicles" element={<Vehicles api={api} actorKey={actorKey} />} />
          <Route path="/jobs/:id" element={<RepairRoom api={api} actorKey={actorKey} />} />
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

const MOBILE_VIDEO_QUERY = '(max-width: 640px)';

function Home({ api }: { api: ApiAdapter }) {
  const catalog = useQuery({ queryKey: ['service-catalog'], queryFn: () => api.listServiceCatalog() });
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileViewport = useMediaQuery(MOBILE_VIDEO_QUERY);

  const entryDoors = [
    { label: "Something's wrong", description: 'Tell us the symptom and get routed to a diagnostic or repair.' },
    { label: 'Tires & maintenance', description: 'Book tire replacement or routine service.' },
    { label: 'Bodywork & paint', description: 'Start a body/paint consultation.' }
  ];

  return (
    <section className="home">
      {/* Video: user-provided (apps/web/public/hero.mp4, 1916x1080/10s). hero-mobile.mp4 is a
          960px-wide mobile spec variant (ffmpeg: scale=960:-2, libx264 CRF 18 "preset slow" for
          visual quality parity with the source, audio stream copied byte-for-byte — untouched
          quality/volume, not re-encoded) — 24MB down to ~3MB. <source media> picks the right file
          per viewport the same way <picture> does for images; posters are real extracted first
          frames per variant, so there's no flash-of-different-image before playback starts.
          autoPlay is only set when the visitor hasn't requested reduced motion — without autoPlay
          a <video> simply displays its poster as a static image, so reduced-motion users still
          see the scene, just not moving. */}
      <div className="hero">
        <video
          className="hero-video"
          poster={isMobileViewport ? '/hero-poster-mobile.jpg' : '/hero-poster.jpg'}
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          aria-hidden="true"
        >
          <source src="/hero-mobile.mp4" media={MOBILE_VIDEO_QUERY} type="video/mp4" />
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-content">
          <h1 className="hero-brand">
            <span className="hero-brand-line">Travel</span>
            <span className="hero-brand-line hero-brand-accent">Automotive</span>
          </h1>
        </div>
      </div>

      {/* Relocated off the video per feedback: the four-sentence promise reads more reliably on
          a plain dark card than fighting a moving background, even a well-scrimmed one. */}
      <section className="promise-card" aria-labelledby="promise-heading">
        <h2 id="promise-heading" className="promise-headline">
          {HERO_LINES.map((line, index) => (
            <span key={line} className="promise-line" style={{ color: `var(--hero-line-${index + 1})` }}>
              {line}
            </span>
          ))}
        </h2>
        <p>Every path below starts with your vehicle.</p>
      </section>

      <div className="entry-doors">
        {entryDoors.map((door) => (
          <Link key={door.label} to="/vehicles" className="entry-door">
            <h2>{door.label}</h2>
            <p>{door.description}</p>
            {/* The whole card is the <Link>, so this is a styled affordance (span), not a
                nested interactive element — a real <button> inside an <a> is invalid HTML. */}
            <span className="entry-door-cta">Get started</span>
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

function Vehicles({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
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
          {createVehicle.isPending ? 'Adding…' : 'Add vehicle'}
        </button>
        {createVehicle.isError && <ValidationErrors error={createVehicle.error} />}
      </form>
    </section>
  );
}

function RepairRoom({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id = 'job-1' } = useParams();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ['job', id, actorKey], queryFn: () => api.getJob(id) });

  // The contract has no GET /quotes/{id} and Job carries no linked quote id/version (see
  // docs/integration-status.md and the CR-002 note below), so "quote-1" / expectedVersion 1 are
  // the only real values available in this checkpoint, not invented ones — they match the
  // backend's seeded fixture exactly. Once accepted, hide the action instead of letting a second
  // click retry a version we already know is stale.
  const acceptQuote = useMutation({
    mutationFn: (input: { quoteId: string; expectedVersion: number }) =>
      api.acceptQuote(input.quoteId, { expectedVersion: input.expectedVersion, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] })
  });

  if (job.isPending) return <p role="status">Loading Repair Room&hellip;</p>;
  if (job.isError) return <ErrorPanel error={job.error} onRetry={() => job.refetch()} />;

  const record = job.data.data;
  const canOfferApproval = record.allowedActions.includes('approve_change_order') && !acceptQuote.isSuccess;

  return (
    <section aria-labelledby="repair-room-heading">
      <h1 id="repair-room-heading">Repair Room</h1>
      <p>
        Status: <StatusBadge status={record.status} /> &middot; version {record.version}
      </p>
      <p>Allowed actions: {record.allowedActions.length ? record.allowedActions.join(', ') : 'none yet'}</p>

      {canOfferApproval && (
        <button
          onClick={() => acceptQuote.mutate({ quoteId: 'quote-1', expectedVersion: 1 })}
          disabled={acceptQuote.isPending}
        >
          {acceptQuote.isPending ? 'Approving…' : 'Approve pending quote (quote-1)'}
        </button>
      )}
      {acceptQuote.isError && <ValidationErrors error={acceptQuote.error} isQuoteApproval />}
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

function ValidationErrors({ error, isQuoteApproval = false }: { error: unknown; isQuoteApproval?: boolean }) {
  if (!(error instanceof ApiRequestError)) {
    return <p role="alert">Something went wrong. Please try again.</p>;
  }
  if (error.status === 409) {
    // There is no GET /quotes/{id} yet (see docs/integration-status.md), so this checkpoint
    // can't actually fetch a fresher version to retry against — don't promise a refresh will help.
    return (
      <p role="alert">
        {error.message}
        {isQuoteApproval ? ' This quote may already be approved.' : ' Refresh to get the latest version.'}
      </p>
    );
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
