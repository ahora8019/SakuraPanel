# Stage 9 — Security & Abuse Hardening

## Status

**In progress.** This document records the first source-level review and defines the order of work. It is not a penetration-test report and does not certify production security.

## Confirmed observations from the current source

- The emergency lock check in `src/index.ts` runs only when `SECURITY_KV` is bound. The production Wrangler configuration binds it, but a missing binding bypasses the lock check rather than failing closed.
- `src/security/abuse-detection.ts` stores scores in an in-process `Map`. The request handler does not currently import or invoke `AbuseDetector`, so it must not be counted as active production abuse protection.
- Rate limiting is implemented with an atomic D1 upsert in `src/security/kv-rate-limit.ts`. The request handler uses `CF-Connecting-IP` and falls back to the shared key `unknown` when that header is absent; this can make unrelated requests share a bucket.
- Security headers are set on public subscription responses, but response headers are assembled separately across other routes. Header coverage needs to be checked route-by-route before claiming a global baseline.
- The owner bootstrap endpoint returns a session token in its JSON response. Any caller handling that response must treat it as a credential and must never log or persist it in plaintext.

## Priority order

### P0 — Fail-closed security controls
- Decide and enforce the expected behavior when `SECURITY_KV` is absent or unavailable. Production must not silently skip the emergency-lock control.
- Add regression tests for both a missing binding and KV read failures. Keep local development behavior explicit rather than relying on accidental bypasses.

### P1 — Request and authentication abuse controls
- Define behavior for a missing or invalid client-IP header on sensitive routes; avoid silently placing all such requests into one shared rate-limit bucket.
- Normalize rate-limit storage failures into an explicit fail-closed response without leaking SQL/runtime details.
- Add bounded request-body handling and strict content-type validation for JSON/form endpoints.
- Add tests for malformed path encoding, oversized bodies, failed login/bootstrap attempts, and rate-limit boundary conditions.
- Decide whether `AbuseDetector` should become a bounded, shared production control or remain a test utility. An in-memory per-isolate map must not be presented as reliable cross-request/cross-isolate enforcement.

### P1 — Response and secret handling
- Establish a consistent security-header baseline for health, readiness, owner UI, bootstrap, public subscription, and internal API responses, without breaking the bootstrap page's required inline assets.
- Verify that errors, logs, diagnostics, and audit metadata never expose session tokens, bootstrap secrets, subscription tokens, or raw credential values.
- Ensure sensitive responses are not cacheable.

### P2 — Verification and operations
- Add regression tests for each hardened behavior.
- Run typecheck, unit tests, dependency audit, and deployment smoke tests.
- Review production bindings and secret configuration without printing secret values.
- Update the roadmap only after the relevant checks pass; CI success alone is not a production security audit.

## Acceptance criteria

- Missing critical production security bindings fail closed.
- Abuse controls have documented, tested behavior under missing headers and storage failures.
- Security headers and cache policy are verified across every route family.
- Credential values are excluded from logs and audit metadata.
- Typecheck, tests, dependency audit, and smoke test pass for the resulting commit.
