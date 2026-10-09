# SakuraPanel — Production Runbook

## Release gate

1. CI must pass: dependency audit, typecheck, tests.
2. Apply D1 migrations before Worker deployment.
3. Prefer additive migrations and expand/migrate/contract for breaking changes.
4. Never assume a Worker rollback reverses a D1 migration.
5. After deployment, check `/health`, `/ready`, and the authenticated diagnostics endpoint.
6. Readiness must show healthy D1, `AUTH_SECRET`, `BOOTSTRAP_SECRET`, and `SECURITY_KV`. A missing emergency-lock binding is a failed release gate.
7. Inspect Workers Logs and Traces for request IDs and error spikes.

## Security controls

- Keep `AUTH_SECRET` and `BOOTSTRAP_SECRET` as Wrangler secrets; each must be at least 32 characters.
- Cookie-authenticated mutations require an exact same-origin `Origin` header. Investigate unexpected `csrf_rejected` responses instead of weakening the check.
- Mutation request bodies are capped at 1 MiB. Keep config/template payloads below that limit.
- The owner dashboard uses a restrictive Content Security Policy, frame denial, no-store caching, and MIME-sniffing protection.
- D1-backed atomic rate limiting must remain enabled for internal routes, public subscriptions, and authentication/bootstrap endpoints.

## Recovery order

### Application-only failure

Rollback the Worker version only when the active database schema remains compatible with the previous application version.

### Database migration failure

Stop the rollout. Do not automatically deploy an older Worker. Inspect migration state and use a corrective forward migration.

### Data corruption

Treat D1 data restoration as a separate incident. Restore only from an explicitly verified backup/export and reconcile application/schema versions before reopening traffic.

## Secret rotation

Rotate Cloudflare API credentials and Worker secrets independently. Never put secrets in Telegram commands, workflow inputs, source files, logs, URLs, or client responses.

- After rotating `AUTH_SECRET`, verify that old signed tokens fail authentication.
- After rotating `BOOTSTRAP_SECRET`, verify the owner login flow and readiness.
- If any session token may have been exposed, invalidate all existing sessions by incrementing each user's `security_version` in D1, then verify the affected sessions no longer authenticate.
- After every rotation, deploy and verify `/health`, `/ready`, owner login, logout, CSRF rejection, and rate limiting.

## Public subscription incident

1. Rotate the affected subscription token.
2. Confirm the old token no longer resolves.
3. Check rate-limit and request logs for the affected window.
4. Review audit records for administrative changes.
5. Do not log or paste the raw subscription token into incident notes.

## Operational principles

- Keep public responses cache-safe and free of internal secrets.
- Keep readiness checks cheap; deep schema/foreign-key diagnostics are for controlled operational checks.
- Preserve migration history. Do not rewrite applied migrations.
- No Endpoint/VPS dependency exists in the current edition.
