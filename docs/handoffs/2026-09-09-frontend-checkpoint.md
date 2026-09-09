# Handoff: frontend checkpoint (branding + full customer-facing shell)

Feature and owner: Everything since the first vertical-slice handoff — real business branding, design system, and the complete customer-facing screen set (Home, My Garage, Vehicle Passport, Tap Your Trouble intake, Repair Room) — Claude.
Branch and commit SHA: `claude/frontend-foundation`, `dccb42891337754beae44def2546a865a8d09675` (25 commits ahead of `feature/issue-1-backend-foundation`, working tree clean).
Contract version: still `1.0.0` (`packages/contracts/openapi.yaml`) — **no backend commits have landed since the first handoff**; `feature/issue-1-backend-foundation` has zero commits this branch doesn't already have. Nothing here required a contract change to build; every gap found is filed as a CR instead.

## What now works

**Branding** (superseded the placeholder "Your Personal Garage" red/graphite direction entirely): the real business is **Travel Automotive** ("Mobile Mechanic"), discovered from a flyer and logo the user provided mid-session. Palette shifted from red to gold (`#f2b705`, visually estimated from the flyer — not canvas-sampled like the rest of the palette, flagged in `styles.css` in case it needs to match a specific print hex). Typography is Anton (Google Fonts) site-wide on headings, matching the flyer's poster-caps lettering. The real logo (`apps/web/public/logo.png`/`.webp`) replaced the text wordmark in the hero.

**Home**: full-bleed video hero (user-provided `hero.mp4`, with a 960px mobile variant and responsive `<source>` selection) carrying only the logo; a four-sentence "promise" card below it (relocated off the video after readability feedback) with a staggered punch-in entrance animation; three entry doors (Something's wrong / Tires & maintenance / Bodywork & paint) with themed hover-animated icons (wrench wiggle, spinning tire, spray-gun particles) that route into the intake wizard; live service catalog from `GET /service-catalog`.

**My Garage** (`/vehicles`): real vehicle list + creation form (`GET`/`POST /vehicles`). Vehicle cards now link to a **Vehicle Passport** detail page (`/vehicles/:id`) — vehicle info needs no new endpoint (looked up client-side from the already-fetched list); the Service History section is honestly pending (CR-003).

**Tap Your Trouble intake** (`/intake/:category`, new): the product agreement's signature guided-intake flow, fully interactive — a real 4-step wizard (pick a real vehicle → category-specific symptom chips + notes → client-side photo preview via object URLs → review). The final Submit is genuinely `disabled` (verified via DOM check, not styling) — no `/service-requests` or `/uploads` endpoint exists yet (CR-005).

**Repair Room** (`/jobs/:id`): job read and quote acceptance are real and integrated (`GET /jobs/{id}`, `POST /quotes/{id}/accept` with a real Idempotency-Key header and a verified 409 conflict path). Dedicated "Inspection findings" and "Messages" sections now exist with real layout (empty-state thread, a composer that is genuinely `disabled`) rather than one generic footnote — CR-004 filed for both endpoints.

**Cross-page polish**: route transitions (fade+slide on every navigation), a reusable page-heading "impact stamp" entrance (same mechanic on every page, not a one-off), staggered card/list entrance throughout, and a sliding gold underline on the nav that actually measures and animates to the active link.

**Code health**: `App.tsx` had grown to 822 lines (over this project's own 800-line guideline) after the intake build; split into `hooks.ts`, `components/shared.tsx`, `lib/devActors.ts`, and one file per route under `routes/`. Pure refactor, verified with a full click-through afterward — `App.tsx` is now 88 lines.

## Files and endpoint operations changed

Everything under `apps/web/` (see `git log --oneline feature/issue-1-backend-foundation..claude/frontend-foundation` for the full 25-commit list — each commit message documents its own verification). New static assets: `hero.mp4`/`hero-mobile.mp4`, `hero-poster*.jpg`, `logo.png`/`logo.webp`. New docs: `docs/change-requests/CR-002.md` through `CR-005.md`, `docs/handoffs/2026-09-08-vertical-slice-1.md` (updated), this file. `docs/integration-status.md` updated to reflect every row above.
No backend-owned files touched (`apps/api`, `packages/domain`, `packages/database`, `packages/contracts/openapi.yaml`, generated client, migrations, root `package.json`). `.claude/launch.json` added (frontend dev-server registration only, for the proper preview mechanism — see that commit for why).
Endpoint operations exercised, all against the real dev API: `getSession` (unused in UI), `listServiceCatalog`, `listVehicles`, `createVehicle`, `getJob`, `acceptQuote`.

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000
pnpm --filter web dev       # Vite on :5173, or use the .claude/launch.json "web" config via preview_start
```

Click through: Home → an entry door → the 4-step intake wizard → My Garage → a vehicle card → Vehicle Passport → Repair Room → Approve pending quote (then again, to see the real 409).

## Tests run and actual results (just re-run, fresh, before writing this)

- `pnpm typecheck` (root, NodeNext) — clean.
- `pnpm test` (root, vitest) — 2 files, 7 tests passed.
- `pnpm --filter web build` — succeeded (89 modules, 228.38 kB JS / 13.02 kB CSS pre-gzip).
- Every feature above was verified live in-browser at the time it was built (not just typechecked) — DOM/`getComputedStyle` checks for the animation and disabled-state claims specifically, not only visual screenshots. See individual commit messages for what was checked per feature.
- Not run: Playwright/E2E suite (none exists yet), automated accessibility audit tooling (axe) — manual checks only (contrast math documented in `styles.css`, keyboard/focus-visible states, 360px layout).

## Known limitations / missing credentials

- **Five open change requests, none actioned**: CR-001 (generated client has no POST/header support — frontend uses a documented `fetch` stopgap), CR-002 (Job carries no linked quote id/version), CR-003 (`/vehicles/{id}/history`), CR-004 (`/jobs/{id}/messages`, `/jobs/{id}/findings`), CR-005 (`/service-requests`, `/uploads`). All in `docs/change-requests/`.
- **Admin/mechanic side is entirely unbuilt** — zero screens. The dev-role switcher can select `mechanic-demo`/`admin-demo`, but there's nothing for those roles to see (no list-jobs-for-mechanic endpoint exists either, so there's nothing to build against yet beyond another pending shell).
- No managed authentication (dev headers only), no booking/availability, no change orders/completion reports/invoices, no account/notification preferences, no phased "Get My Car Right" plans.
- The gold accent (`#f2b705`) is a visual estimate from a flyer image, not a sampled/extracted value — flag if the business has an exact print hex.

## What the other agent (Codex) must do next

1. **Action the CRs, in rough priority order**: CR-001 (unblocks removing the fetch stopgap everywhere), CR-005 (Tap Your Trouble can't do anything real without it — it's the signature feature), CR-004 (Repair Room communication), CR-002 and CR-003 (smaller, self-contained).
2. Review/merge `claude/frontend-foundation`; no conflicts expected (zero concurrent commits on the backend branch), but `pnpm-lock.yaml` picked up frontend dependencies (React, Vite, etc.) — worth a glance.
3. No backend defects found in any of the five implemented operations this whole checkpoint — all behaved exactly per `openapi.yaml` (role checks, validation, 409 conflict, ownership checks all verified live, repeatedly).
