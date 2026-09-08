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
