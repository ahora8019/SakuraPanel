# SakuraPanel v1 Systems — Implementation Notes

This document describes the implemented behavior and its current limits. It is not a claim that Production is deployed or that all five systems have passed release verification.

## Config Studio

- Reads existing D1 config records through the existing repository; no new configuration store is introduced. The UI can inspect up to 100 records at a time, filter by state, select records, and export only selected IDs; server-side ownership is checked again on export.
- Enforces config:read server-side. MEMBER exports are always scoped to the authenticated user's ID, regardless of a supplied userId.
- JSON export validates the model, excludes expired/revoked/invalid/sensitive records, and omits the internal identity and metadata wrapper keys that ConfigEngine adds. Corrupt, non-object, or missing stored payload JSON is marked invalid through a non-enumerable internal marker so the marker itself is never exported.
- Protocol links are emitted only when an existing payload already contains a syntactically valid connection URI for a scheme represented by the current compatibility model (VLESS, VMess, Trojan, Shadowsocks). SakuraPanel does not synthesize protocol payloads.
- Subscription export requires an existing subscription ID, checks ownership/status/expiry, reads its real latest version and referenced configs, and emits the current public subscription JSON envelope. The existing public endpoint is JSON, so this implementation deliberately does not invent a Base64 client format.
- Sensitive credential-bearing fields exclude the whole record rather than redacting a protocol payload in a way that could silently break it.

## Sakura Pulse

- Performs read-only D1 checks for connectivity, required tables/columns/indexes, foreign-key integrity, active Owner setup, auth-secret configuration (length only), and Emergency Lock state.
- Returns individual passed, failed, unavailable, or skipped checks and measured duration. A failed/skipped check is not reported as healthy.
- The /ready endpoint exposes only check statuses, never secret values.
- /internal/pulse, /internal/pulse/history, and the existing diagnostics endpoint remain reachable during Emergency Lock for authenticated read-only diagnosis. All other protected operations retain the global lock guard.
- The existing hourly Cloudflare Cron handler now runs Pulse and records scheduled results in migration 0019 system_check_runs. Duplicate slots are ignored, stale running rows are recovered, and retention is bounded to 30 days / 1,000 rows. The history API is Owner-only. This history remains unavailable in an environment until migration 0019 is applied.

## Sakura Speed Lab

- Takes one bounded server-side D1 SELECT 1 timing sample and one local JSON serialization timing sample. The UI separately measures browser-observed API round-trip time.
- Reports measurement scope and explicitly warns that a single sample is not a benchmark.
- Cloudflare platform analytics and external-service timing are reported as unavailable because the Worker does not currently have an analytics binding or configured external route model.
- Samples are not persisted for historical comparison.

## Route Advisor

- The scoring utility requires a compatible candidate, healthy status, latency/error evidence, at least three samples, and evidence no older than 15 minutes. It reports insufficient data when evidence is absent/stale.
- The current database migration 0016_remove_endpoints.sql intentionally removed the legacy endpoints and endpoint_health tables. The live API therefore returns insufficient_data; it does not fabricate routes, use configs as endpoints, or change any user configuration.
- A future live recommendation path requires a supported, explicitly configured route-candidate model and a trustworthy source of repeated measurements. No automatic switching is implemented.

## Safe Release Lab

- scripts/release-gate.mjs checks the repository's actual Wrangler binding names, environment contract, migration ordering, and required regression-test files.
- .github/workflows/release-validation.yml runs dependency audit, preflight, typecheck, Vitest, and a Wrangler dry-run build; it writes an evidence summary and blocks if a mandatory step fails or is skipped.
- The manual Production deployment workflow repeats the mandatory preflight, runs a dry-run build, inspects remote migration state read-only, and only then reaches the explicit migration/deploy steps.
- CI/build validation does not prove live Production health, successful backup restore, or a successful Production deployment.

## Shared security and operational limits

- Migration 0019 adds the bounded system_check_runs history table and indexes. It has been added to source but has not been applied to Production.
- No Production deployment, remote migration, lock reset, backup restore, or user-data mutation was performed by this change.
- Live route candidates, full multi-sample telemetry ingestion, and a protocol-client-specific Base64 subscription contract remain unimplemented because the current codebase does not provide those data contracts.
- Before v1.0, run the release-validation workflow on the final PR revision, configure and verify an isolated Preview environment, run an isolated restore drill, verify the Production /ready result after an explicitly authorized deployment, and review the actual Owner/RBAC/Emergency Lock regression evidence.
