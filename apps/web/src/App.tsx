import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { createApiAdapter } from './lib/apiAdapter.js';
import { DEV_ACTORS, type ActorKey } from './lib/devActors.js';
import { Home } from './routes/Home.js';
import { Vehicles } from './routes/Vehicles.js';
import { VehiclePassport } from './routes/VehiclePassport.js';
import { Intake } from './routes/Intake.js';
import { RepairRoom } from './routes/RepairRoom.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:3000/api/v1';

// A shared bar that slides to whichever nav link is active, instead of each link getting its
// own static underline — a continuous visual thread as you move between pages. Measures the
// active <a>'s position via a plain DOM query (react-router's NavLink already puts an "active"
// class on it) rather than tracking route-to-ref mappings by hand.
function PrimaryNav() {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLAnchorElement>('a.active');
    setUnderline(active ? { left: active.offsetLeft, width: active.offsetWidth, visible: true } : { left: 0, width: 0, visible: false });
  }, [location.pathname]);

  return (
    <nav aria-label="Primary" ref={navRef} className="primary-nav">
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
    </div>
  );
}

export default function App() {
  const [actorKey, setActorKey] = useState<ActorKey>('customer');
  const api = useMemo(() => createApiAdapter({ baseUrl: API_BASE_URL, actor: DEV_ACTORS[actorKey] }), [actorKey]);
  const location = useLocation();

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <DevSessionBar actorKey={actorKey} onChange={setActorKey} />
      <header className="app-header">
        <Link to="/" className="brand"><span className="accent">&#9679;</span> Travel Automotive</Link>
        <PrimaryNav />
      </header>
      <main id="main-content">
        {/* key={pathname} forces a remount on every navigation, replaying the page-enter CSS
            animation each time — the connective "same continuous app" transition between routes. */}
        <div key={location.pathname} className="page-transition">
          <Routes>
            <Route path="/" element={<Home api={api} />} />
            <Route path="/vehicles" element={<Vehicles api={api} actorKey={actorKey} />} />
            <Route path="/vehicles/:id" element={<VehiclePassport api={api} actorKey={actorKey} />} />
            <Route path="/intake/:category" element={<Intake api={api} actorKey={actorKey} />} />
            <Route path="/jobs/:id" element={<RepairRoom api={api} actorKey={actorKey} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
