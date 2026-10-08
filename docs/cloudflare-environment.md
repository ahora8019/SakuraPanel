# SakuraPanel — Cloudflare Environment Contract

This document defines the production bindings and secrets required before the first real Cloudflare deployment.

## Required secret

- `AUTH_SECRET`: HMAC signing secret.
  - Store it as a Wrangler secret, never in Git.
  - Minimum length enforced by `AuthService`: 32 characters.

## Required binding

- `DB`: Cloudflare D1 database.
  - Contains users, devices, endpoints, templates, configs, subscriptions, sessions, audit logs, and indexes.
  - Apply migrations in numeric order before enabling authenticated `/internal/*` routes.

## Optional bindings

- `RATE_LIMIT_KV`: distributed rate-limit state.
- `SECURITY_KV`: emergency-lock state.

The Worker intentionally fails closed for internal routes when `DB` is not configured.

## Deployment sequence

1. Create the D1 database.
2. Put its real database ID into the deployment configuration.
3. Apply migrations.
4. Configure `AUTH_SECRET` as a secret.
5. Create the optional KV namespaces if rate limiting and emergency lock are enabled.
6. Deploy the Worker.
7. Verify `GET /health`.
8. Verify authenticated HTTP flows against D1.
9. Only then enable real endpoint/config provisioning.

Do not commit real database IDs, API tokens, private keys, or authentication secrets unless they are explicitly non-sensitive public identifiers.
