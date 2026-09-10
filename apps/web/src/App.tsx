import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createApiAdapter } from './lib/apiAdapter.js';
import { DEV_ACTORS, type ActorKey } from './lib/devActors.js';
import { useSupabaseSession } from './lib/useSupabaseSession.js';
import { Home } from './routes/Home.js';
import { Vehicles } from './routes/Vehicles.js';
import { VehiclePassport } from './routes/VehiclePassport.js';
import { Intake } from './routes/Intake.js';
import { RepairRoom } from './routes/RepairRoom.js';
import { MechanicJobs } from './routes/MechanicJobs.js';
import { AdminJobs } from './routes/AdminJobs.js';
import { AdminIssueQuote } from './routes/AdminIssueQuote.js';
import { AdminProvisionMembership } from './routes/AdminProvisionMembership.js';
import { SignIn } from './routes/SignIn.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:3000/api/v1';

// A shared bar that slides to whichever nav link is active, instead of each link getting its
// own static underline — a continuous visual thread as you move between pages. Measures the
// active <a>'s position via a plain DOM query (react-router's NavLink already puts an "active"
// class on it) rather than tracking route-to-ref mappings by hand.
function PrimaryNav({ actorKey }: { actorKey: ActorKey }) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLAnchorElement>('a.active');
    setUnderline(active ? { left: active.offsetLeft, width: active.offsetWidth, visible: true } : { left: 0, width: 0, visible: false });
  }, [location.pathname, actorKey]);

  return (
    <nav aria-label="Primary" ref={navRef} className="primary-nav">
      {actorKey === 'customer' && (
        <>
          <NavLink to="/vehicles" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            My Garage
          </NavLink>
          {/* Hardcoded seeded job id (packages/database/src/seed.ts) — the contract has no
              "list my jobs" endpoint for customers, so there's no real id to discover dynamically
              yet. The old "job-1" fixture id stopped resolving once persistence moved to real
              Postgres (verified live: it now 403s for customer-demo). */}
          <NavLink
            to="/jobs/44444444-4444-4444-8444-444444444444"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Repair Room
          </NavLink>
        </>
      )}
      {actorKey === 'mechanic' && (
        <NavLink to="/mechanic/jobs" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          My Jobs
        </NavLink>
      )}
      {actorKey === 'admin' && (
        <>
          <NavLink to="/admin/jobs" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Admin
          </NavLink>
          <NavLink to="/admin/quotes/new" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            New Quote
          </NavLink>
          <NavLink to="/admin/memberships/new" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Grant Access
          </NavLink>
        </>
      )}
      <span
        className="nav-underline"
        aria-hidden="true"
        style={{ left: underline.left, width: underline.width, opacity: underline.visible ? 1 : 0 }}
      />
    </nav>
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
      <Link to="/sign-in">Sign in with a real account</Link>
    </div>
  );
}

// Shown instead of DevSessionBar once a real Supabase session exists — the two are mutually
// exclusive so it's always clear which auth source is active, rather than showing both at once.
function RealSessionBar({ email, role, onSignOut }: { email: string; role: string | null; onSignOut: () => void }) {
  return (
    <div className="dev-session-bar" role="note">
      <span>
        Signed in as {email}
        {role ? ` (${role})` : ''}
      </span>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  const [actorKey, setActorKey] = useState<ActorKey>('customer');
  const auth = useSupabaseSession();
  const accessToken = auth.session?.access_token;
  const location = useLocation();

  const api = useMemo(
    () => createApiAdapter(accessToken ? { baseUrl: API_BASE_URL, accessToken } : { baseUrl: API_BASE_URL, actor: DEV_ACTORS[actorKey] }),
    [accessToken, actorKey]
  );

  // Role for a real session comes from the server (memberships table), not anything the client
  // asserts — GET /session is the same endpoint the dev-header path already relies on, just
  // authenticated with the real bearer token instead. Query key includes accessToken so signing
  // out (token goes to undefined, enabled flips false) never serves a stale cached role.
  const realSession = useQuery({
    queryKey: ['real-session', accessToken],
    queryFn: () => api.getSession(),
    enabled: Boolean(accessToken),
    retry: false
  });

  // The value every route component already keys its queries and role-gating on. For a real
  // session this is the server-resolved role (once known); for dev mode it's just the switcher's
  // current selection, unchanged from before.
  const effectiveActorKey: ActorKey | undefined = accessToken ? (realSession.data?.user.role as ActorKey | undefined) : actorKey;

  if (auth.isLoading) {
    return (
      <div className="app-shell">
        <p role="status" style={{ padding: 'var(--space-4)' }}>
          Loading session&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {accessToken ? (
        <RealSessionBar
          email={auth.session?.user.email ?? 'unknown'}
          role={realSession.data?.user.role ?? null}
          onSignOut={() => void auth.signOut()}
        />
      ) : (
        <DevSessionBar actorKey={actorKey} onChange={setActorKey} />
      )}
      <header className="app-header">
        <Link to="/" className="brand"><span className="accent">&#9679;</span> Travel Automotive</Link>
        {effectiveActorKey && <PrimaryNav actorKey={effectiveActorKey} />}
      </header>
      <main id="main-content">
        {/* key={pathname} forces a remount on every navigation, replaying the page-enter CSS
            animation each time — the connective "same continuous app" transition between routes. */}
        <div key={location.pathname} className="page-transition">
          {accessToken && realSession.isPending && <p role="status">Loading your account&hellip;</p>}
          {accessToken && realSession.isError && (
            <div role="alert" className="error-panel">
              <p>
                Your account isn&rsquo;t set up with this business yet. Contact the shop to get access, or{' '}
                <button type="button" onClick={() => void auth.signOut()}>
                  sign out
                </button>
                .
              </p>
            </div>
          )}
          {/* effectiveActorKey is only undefined while a real session's role is still resolving
              or failed to resolve (both handled above) — in dev mode actorKey always has a
              value, so this is the only Routes block the app needs. */}
          {effectiveActorKey && (
            <Routes>
              <Route path="/" element={<Home api={api} />} />
              <Route path="/sign-in" element={<SignIn auth={auth} />} />
              <Route path="/vehicles" element={<Vehicles api={api} actorKey={effectiveActorKey} />} />
              <Route path="/vehicles/:id" element={<VehiclePassport api={api} actorKey={effectiveActorKey} />} />
              <Route path="/intake/:category" element={<Intake api={api} actorKey={effectiveActorKey} />} />
              <Route path="/jobs/:id" element={<RepairRoom api={api} actorKey={effectiveActorKey} />} />
              <Route path="/mechanic/jobs" element={<MechanicJobs api={api} actorKey={effectiveActorKey} />} />
              <Route path="/admin/jobs" element={<AdminJobs api={api} actorKey={effectiveActorKey} />} />
              <Route path="/admin/quotes/new" element={<AdminIssueQuote api={api} actorKey={effectiveActorKey} />} />
              <Route path="/admin/memberships/new" element={<AdminProvisionMembership api={api} />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
}
