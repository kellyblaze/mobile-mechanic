# Security review

Security-sensitive: yes. Reviewed authentication adapter, API routes, validation, schema and error handling against OWASP categories A01–A10.

Passes at checkpoint: role and resource checks on implemented routes; Zod validation; no secrets committed; no card data; no stack traces in API errors; secure production-auth direction documented; SQL schema uses constraints and foreign keys.

Current limitations: development headers are intentionally unsafe outside local use; use `AUTH_MODE=managed` in production. Rate limiting is process-local and must be moved to a shared gateway or Redis before horizontal scaling. PostgreSQL RLS, private upload signing, webhook verification, audit persistence, and provider integration require final deployment validation. React Router has been upgraded to v7.18.3; `pnpm audit --prod` currently reports no known vulnerabilities.
