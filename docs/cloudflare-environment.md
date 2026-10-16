# SakuraPanel — Cloudflare Environment Contract

This document defines the production bindings and secrets required before the first real Cloudflare deployment.

## Required secrets

- `AUTH_SECRET`: HMAC signing secret for session tokens.
  - Store it as a Wrangler secret, never in Git.
  - Minimum length: 32 characters.
- `BOOTSTRAP_SECRET`: high-entropy owner bootstrap/login secret.
  - Store it as a Wrangler secret, never in Git or a plain Worker variable.
  - Minimum length: 32 characters. Prefer a randomly generated secret rather than a memorable password.
  - Treat it as a privileged credential: it can establish the first OWNER and authenticate the OWNER session.
  - Rotate it immediately if exposed. Existing sessions remain governed by their signed expiry and database session state.

## Required bindings

- `DB`: Cloudflare D1 database.
  - Contains users, devices, templates, configs, subscriptions, sessions, audit logs, and rate-limit buckets.
  - Apply migrations in numeric order before enabling authenticated `/internal/*` routes.
- `SECURITY_KV`: emergency-lock state.
  - Required in production. Readiness returns `503` if this binding is missing because the emergency-lock control would otherwise be unavailable.
- Rate limiting is backed by D1's atomic upsert in `rate_limit_buckets`; it does not depend on an optional `RATE_LIMIT_KV` binding.

The Worker intentionally fails closed for internal routes when `DB` is not configured. It also rejects cookie-authenticated mutations without an exact same-origin `Origin` header and enforces a 1 MiB request-body limit.

## Deployment sequence

1. Create the D1 database and the `SECURITY_KV` namespace.
2. Put the real database and KV identifiers into the deployment configuration.
3. Apply migrations in numeric order.
4. Configure `AUTH_SECRET` and `BOOTSTRAP_SECRET` as Wrangler secrets, each at least 32 characters.
5. Deploy the Worker.
6. Verify `GET /health` and `GET /ready`. Readiness must report database, authentication, bootstrap authentication, and emergency-lock checks as healthy.
7. Verify authenticated HTTP flows against D1, including login, logout, CSRF rejection, and rate limiting.
8. Config generation is available directly from templates and user/device identity; no external endpoint is required.

Do not commit real API tokens, private keys, or authentication secrets. Database and KV identifiers are deployment metadata, but should still be managed carefully.
