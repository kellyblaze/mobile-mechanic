# Security review

Security-sensitive: yes. Reviewed authentication adapter, API routes, validation, schema and error handling against OWASP categories A01–A10.

Passes at checkpoint: role and resource checks on implemented routes; Zod validation; no secrets committed; no card data; no stack traces in API errors; secure production-auth direction documented; SQL schema uses constraints and foreign keys.

Limitations: development headers are intentionally unsafe outside local use; managed authentication, CSRF/session implementation, rate limiting, PostgreSQL RLS, private upload signing, webhook verification, audit persistence, and provider integration remain before production. `pnpm audit --prod` reports two moderate React Router advisories in the Claude frontend dependency tree; upgrading is deferred because it may be a major-version frontend change and requires owner approval.
