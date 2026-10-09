# SakuraPanel — Next-Generation Roadmap

## Product principles

SakuraPanel is a Cloudflare-native panel, not a clone of BPB, Nahan, Zeus, or EdgeTunnel. Priorities are security, stability, performance, compatibility, maintainability, then visual polish. The current edition does not require external VPS endpoints.

## Implemented in source (must still be verified against the deployed revision)

- D1-backed users, devices, templates, configs, subscriptions, sessions, audit logs, and rate limiting.
- Config generation, validation, versioning, release tracking, and subscription delivery.
- Role/permission policy for OWNER, ADMIN, and MEMBER.
- Session validation, token expiry, security-version invalidation, and audit-field redaction.
- Emergency Lock that fails closed when its required KV binding is absent or unavailable.
- Health and readiness endpoints; readiness includes database and security-control checks.
- CI dependency audit, typecheck, and test steps.
- Manual-only production deployment workflow with pre-deploy audit/typecheck/tests and a post-deploy smoke test.

## v1.0.0 release gates

1. **CI:** current `main` commit passes dependency audit, typecheck, and full tests.
2. **RBAC/Owner:** endpoint-by-endpoint role matrix and cross-user ownership regression tests; verify no MEMBER can access another user's resources or grant privileges.
3. **Backup/restore:** create a real export, retain it securely outside Git, restore it to an isolated D1 database, and verify schema/integrity/counts.
4. **Preview:** deploy an isolated preview Worker with its own D1 database, KV namespace, and independent secrets.
5. **Production:** verify deployed revision and bindings, run smoke tests, verify `/ready` reports both database and security control healthy, and test authenticated owner flows.
6. **UI:** complete and test mobile-first owner dashboard and subscription experience, including loading/error/empty states, keyboard access, and responsive layout.
7. **Release:** tag `v1.0.0` only after all gates have recorded PASS evidence.

## Remaining work

- Complete the full RBAC and ownership audit; current unit tests are not sufficient for a complete route-level certification.
- Define and test behavior for missing client-IP headers and D1 rate-limit storage failures.
- Review request-body limits, content-type validation, path decoding, response security headers, and cache policy route by route.
- Build and validate the preview environment without production credentials or data.
- Perform a real backup and isolated restore drill.
- Finish the UI and run authenticated end-to-end tests.
- Verify the deployed Worker is updated to the current repository commit; a live readiness response without `checks.securityControl` indicates an older deployment.
