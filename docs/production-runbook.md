# SakuraPanel — Production Runbook

## Release gate

1. CI must pass: dependency audit, typecheck, tests.
2. Apply D1 migrations before Worker deployment.
3. Prefer additive migrations and expand/migrate/contract for breaking changes.
4. Never assume a Worker rollback reverses a D1 migration.
5. After deployment, check `/health` and the authenticated diagnostics endpoint.
6. Inspect Workers Logs and Traces for request IDs and error spikes.

## Recovery order

### Application-only failure

Rollback the Worker version only when the active database schema remains compatible with the previous application version.

### Database migration failure

Stop the rollout. Do not automatically deploy an older Worker. Inspect migration state and use a corrective forward migration.

### Data corruption

Treat D1 data restoration as a separate incident. Restore only from an explicitly verified backup/export and reconcile application/schema versions before reopening traffic.

## Secret rotation

Rotate Cloudflare API credentials and Worker secrets independently. Never put secrets in Telegram commands, workflow inputs, source files, logs, URLs, or client responses. After rotation, perform a deployment and health verification.

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
