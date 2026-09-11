# Development setup and verification

Requirements: Node 20+, pnpm 10+, and PostgreSQL 18 only when applying the migration. No provider credentials are required for this checkpoint.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Smoke test in another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/v1/service-catalog
Invoke-RestMethod -Headers @{ 'X-Dev-User-Id'='customer-demo'; 'X-Dev-Role'='customer' } http://127.0.0.1:3000/api/v1/vehicles
```

`pnpm api:mock` explicitly sets `MOCK_MODE=true`; it does not silently turn on in production. `pnpm db:migrate` validates migration presence only in this checkpoint; use an approved PostgreSQL migration runner before applying to a real database.

## Staging deployment

The repository contains `render.yaml` for the API and `vercel.json` for the web preview. Deploy the
API from the Render Blueprint dashboard and the web app from Vercel using branch
`feature/issue-2-backend-completion`. Fill every `sync: false` value from the staging provider
configuration; never commit those values. Run `pnpm db:migrate` against the staging Supabase
database before the first API start, then use the deployed `/health` endpoint and the managed-auth,
Stripe test-mode, upload, booking, and authorization scripts as the staging gate.
