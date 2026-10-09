# SakuraPanel — Cloudflare Environment Contract

This document describes the bindings the current Worker code actually uses. It is not evidence that a separate preview environment exists or that a production restore has been tested.

## Required Worker secrets

- `AUTH_SECRET`: HMAC signing secret, at least 32 characters.
- `BOOTSTRAP_SECRET`: secret used for first-owner bootstrap and the current owner login flow.

Store both as Cloudflare Worker secrets. Never commit their values, put them in URLs, or print them in logs. Rotate them through the Cloudflare dashboard or Wrangler secret commands.

## Required bindings

- `DB`: Cloudflare D1. The current implementation uses it for users, devices, templates, configs, subscriptions, sessions, audit logs, and rate-limit buckets.
- `SECURITY_KV`: emergency-lock state. This is **required**, not optional. Requests fail closed if it is missing, and readiness fails unless the lock state can be read and is clear.

## Not used by the current runtime

- `RATE_LIMIT_KV` is not used by the current rate limiter. Rate limiting is implemented with D1 through `src/security/kv-rate-limit.ts`. Do not create or configure a `RATE_LIMIT_KV` binding unless the implementation changes and is tested.

## Production release gate

1. Confirm CI passes dependency audit, typecheck, and tests.
2. Verify the production Worker has `DB`, `SECURITY_KV`, `AUTH_SECRET`, and `BOOTSTRAP_SECRET` without revealing secret values.
3. Apply D1 migrations in numeric order only after confirming the target database.
4. Deploy only through an explicitly authorized production release.
5. Verify `GET /health` and `GET /ready`. Readiness must include both `database: "ok"` and `securityControl: "ok"`.
6. Run the smoke test and authenticated owner/RBAC checks.

## Preview isolation requirements

Preview must use a separate Worker name, a separate D1 database, a separate `SECURITY_KV` namespace, and independent `AUTH_SECRET` and `BOOTSTRAP_SECRET` values. Never point preview at the production D1 database or reuse production secrets. Preview migrations and tests must target only preview resources.

## Backup and recovery

Use the procedures in `docs/production-runbook.md`. A D1 bookmark or a successful export request alone does not prove that a backup is downloadable, retained, or restorable. Do not test restoration against production data; restore to an isolated database and verify schema and representative row counts first.

Do not commit API tokens, private keys, authentication secrets, or actual backup contents to Git.
