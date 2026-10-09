# SakuraPanel — Security and Abuse Hardening Audit

## Scope and status

This is a source-level checklist plus CI evidence, not a penetration-test report or a production security certification.

- [x] Emergency lock fails closed when `SECURITY_KV` is missing or cannot be read.
- [x] Readiness checks both D1 connectivity and emergency-lock state.
- [x] RBAC role/permission policy is centralized in `src/security/permissions.ts`.
- [x] Production deployment workflow is manual-only and runs dependency audit, typecheck, and tests before D1 migrations/deployment.
- [ ] Re-run CI for the current `main` commit after the Emergency Lock merge.
- [ ] Full endpoint-by-endpoint RBAC and Owner authorization audit with regression tests.
- [ ] Cross-user ownership tests for every read/write route and resource type.
- [ ] Missing/invalid client-IP behavior and D1 rate-limit storage-failure behavior.
- [ ] Consistent security headers and no-store policy verified across all route families.
- [ ] Request-body size limits, content-type validation, malformed path handling, and auth-abuse boundary tests.
- [ ] Confirm production live deployment contains the Emergency Lock fix. The live `/ready` response must expose `checks.securityControl`; if absent, production is behind the repository.
- [ ] Actual backup artifact downloaded and securely retained.
- [ ] Restore drill completed against an isolated D1 database.
- [ ] Isolated preview deployment validated with separate D1 and secrets.
- [ ] Production smoke test and authenticated owner flows executed against the deployed revision.

## Confirmed implementation details

- Rate limiting is stored in D1 using an atomic upsert; `RATE_LIMIT_KV` is not used by the current runtime.
- The request handler currently falls back to the shared key `unknown` if `CF-Connecting-IP` is absent. This needs an explicit tested policy so unrelated requests do not share a rate-limit bucket.
- `AbuseDetector` uses an in-process `Map` and is not invoked by the main request handler. It must not be counted as active distributed production protection.
- The Owner UI and bootstrap/login paths require live authentication-flow tests. A page rendering successfully is not proof that login, session revocation, role checks, or mutations work.
- A successful CI run verifies the checked commit, not the currently deployed Worker or its live secrets/bindings.

## Release acceptance criteria

Do not label the release `v1.0.0` until the outstanding security, ownership, backup/restore, preview, UI, and production checks above have evidence attached to the exact release commit. Keep failed workflow history; fix failures rather than deleting evidence.
