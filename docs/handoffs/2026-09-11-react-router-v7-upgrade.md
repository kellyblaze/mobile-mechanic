# Handoff: react-router-dom v6 → v7 upgrade (security advisories resolved)

Feature and owner: Upgraded `react-router-dom` to resolve open v6 security advisories — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `3317604178cc09590e079ab484b9430c131011fe` (working tree clean, pushed to `origin`).
Contract version: `1.9.0` unchanged — this is a pure frontend dependency upgrade, no API-facing behavior touched.

## What changed

`react-router-dom` `^6.28.0` → `^7.18.3` (latest). This app uses pure **Declarative Mode** — `BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useParams`, `useNavigate`, `useLocation`, no data routers, no loaders/actions/fetchers, no framework/Vite-plugin mode — which v7 keeps as a fully backward-compatible mode under the same package. Result: **zero application code changes needed** beyond the version bump and one clarifying comment in `main.tsx`.

## How this was verified, not guessed

A first web search summary claimed the `element` prop on `<Route>` was being replaced by a `component` prop and that `<Routes>`/`<Route>` needed converting to `createBrowserRouter`/`createRoutesFromElement` config objects — **false** for Declarative Mode specifically (that guidance is for Data/Framework Mode). Caught this by cross-checking a second source and then, more importantly, by installing the real package and reading its actual shipped `.d.ts` files directly rather than trusting either summary:

- `node_modules/.pnpm/react-router-dom@7.18.3.../dist/index.d.ts` confirmed `react-router-dom` v7 re-exports everything from the new unified `react-router` package plus DOM-specific bits — no import path changes needed for this app's usage.
- `node_modules/.pnpm/react-router@7.18.3.../index-react-server-client-*.d.ts` confirmed `BrowserRouterProps`'s real shape: `{ basename?, children?, useTransitions?, window? }` — **no `future` object exists in v7 at all**, contradicting a web search summary that suggested passing `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` (v6-only API). Caught this the hard way — added that prop first, TypeScript immediately rejected it (`Property 'future' does not exist on type 'BrowserRouterProps'`), then read the real type to find the actual fix: `useTransitions`, left `undefined` (the default), already wraps every router state update in `React.startTransition` unconditionally — the exact v6 "v7_startTransition" future-flag behavior, now permanent and needing no opt-in. v6's other future flag, `v7_relativeSplatPath`, has no corresponding prop at all anymore in v7 — that behavior is simply always-on now (moot here regardless: this app has no splat/`*` routes).
- Confirmed no other workspace package depends on `react-router` (`grep -rl react-router --include=package.json apps packages`) and that only one version resolves in the real dependency graph (`pnpm why react-router-dom --recursive` → single line, `react-router-dom@7.18.3`, used only by `@mobile-mechanic/web`). Leftover `react-router-dom@6.30.6`/`react-router@6.30.6` directories still visible under `node_modules/.pnpm` are unreferenced pnpm store cache, not an active dependency — pnpm doesn't prune old store entries automatically.

## Live-verified, in a genuinely fresh environment

An early check (still in the same long-running browser tab used all session) showed stale v6-era React Router future-flag console warnings even after the version bump. Rather than assume that was expected v7 behavior, cleared Vite's dependency pre-bundle cache (`apps/web/node_modules/.vite`) and opened a **brand-new browser tab** — the warnings disappeared completely, confirming they were a stale-bundle artifact from the long-lived tab/dev-server state, not a real v7 gap.

In that fresh tab, clicked through **every one of the app's 17 routes**, across all three dev roles (customer-demo/mechanic-demo/admin-demo):

Home, My Garage, Vehicle Passport (dynamic `:id`), Book, Intake (dynamic `:category`), Repair Room (dynamic `:id`, including the cancellation UI added earlier this session), Pay Invoice (dynamic `:id`), My Jobs, Admin Jobs, New Quote (including the real photo-attachment-count feature from an earlier checkpoint), Grant Access, all four Monitoring screens (Overview, Issues with the mock-data toggle, a nested Issue Detail `:id` route, Operations), Sign In, and Admin Issue Invoice.

Console checked after each significant navigation: zero errors, zero React Router warnings, throughout.

## Files changed

`apps/web/package.json` (dependency bump), `apps/web/src/main.tsx` (comment only — no functional change), `pnpm-lock.yaml`.

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000
pnpm --filter web dev       # Vite on :5173, or the .claude/launch.json "web" config via preview_start
```

Click through the primary nav for each dev role; everything should behave identically to before the upgrade. If testing right after a `pnpm install` that bumped the router version, open a fresh browser tab (or hard-reload) rather than reusing a tab that was open before the install — Vite's dependency pre-bundle can otherwise serve a stale cached bundle that shows spurious v6-era warnings, exactly as happened during this verification.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, **39 tests passed**, unchanged count (this upgrade touched no adapter code, no new test surface).
- `pnpm --filter web build` — succeeded (163 modules, up from 157 — react-router's own module count grew under v7, expected; 529.00 kB JS / 14.33 kB CSS pre-gzip).
- Full 17-route, 3-role manual walkthrough in a fresh browser tab, described above — all passed, console clean.

## Known limitations

None found. This was a clean, fully backward-compatible upgrade for this app's specific usage pattern (Declarative Mode). If the app ever adopts data routers (loaders/actions) or the new framework mode, that would be a separate, much larger migration — not needed today and not started here.

## What the other agent (Codex) should look at next

Nothing router-related. Unrelated to this checkpoint: `.env`'s duplicate `AUTH_MODE` line (flagged in multiple earlier handoffs) is still present.
