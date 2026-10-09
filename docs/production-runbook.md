# SakuraPanel — Production Runbook

## Release gate

1. CI must pass: dependency audit, typecheck, tests.
2. Verify the target Worker, D1 database, required `SECURITY_KV`, and secret names before any operation.
3. Apply D1 migrations before Worker deployment, and only after confirming the target database.
4. Prefer additive migrations and expand/migrate/contract for breaking changes.
5. Never assume a Worker rollback reverses a D1 migration.
6. After deployment, check `/health` and `/ready`. Readiness must report both database and security control as healthy.
7. Run `scripts/smoke-test.mjs` against the exact deployed URL.
8. Inspect Workers Logs and Traces for request IDs and error spikes without logging credential values.

## Backup requirements

Follow `docs/backup-restore-drill.md` to create a real D1 SQL export. A bookmark or a successful export request alone is not a verified backup. Record the export checksum, securely retain the encrypted artifact outside Git, and periodically verify it by restoring into a separate D1 database.

## Recovery order

### Application-only failure

Rollback the Worker version only when the active database schema remains compatible with the previous application version.

### Database migration failure

Stop the rollout. Do not automatically deploy an older Worker. Inspect migration state and use a corrective forward migration.

### Data corruption

Treat D1 data restoration as a separate incident. Restore only from an explicitly verified backup/export and reconcile application/schema versions before reopening traffic. Never restore over production as a test.

## Secret rotation

Rotate Cloudflare API credentials and Worker secrets independently. Never put secrets in Telegram commands, workflow inputs, source files, logs, URLs, or client responses. After rotation, perform a deployment smoke test and verify authenticated flows.

## Preview environment

Preview must use a dedicated D1 database, a dedicated `SECURITY_KV` namespace, and separate `AUTH_SECRET` and `BOOTSTRAP_SECRET` values. See `docs/preview-environment.md`. Do not point preview at production resources.

## Release evidence

Record the source commit, CI run, deployment/version identifier, smoke-test output, readiness result, backup/restore drill evidence, and reviewer. If a step was not actually run, label it `NOT RUN`; do not infer success from configuration alone.
