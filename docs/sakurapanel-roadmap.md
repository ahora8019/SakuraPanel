# SakuraPanel — Next-Generation Roadmap

## Product principle

SakuraPanel is not a clone of BPB, Nahan, Zeus, or EdgeTunnel. Those projects are functional benchmarks only. SakuraPanel prioritizes:

1. Security
2. Stability
3. Performance
4. Compatibility
5. Maintainability
6. UX/design last

No VPS/endpoint architecture is planned for the current Cloudflare-native edition.

## Feature set to build

### Core / Backend
- Config Validation Engine
- Config Versioning and Release model
- Config publish/rollback
- Subscription Delivery Engine hardening
- Subscription self-diagnostics
- Subscription diagnostics API and automated integrity tests
- Client Compatibility Matrix
- Request IDs and structured logs
- Production health/readiness checks
- Audit Timeline
- Backup/restore procedures
- Config release tracking
- Published-version delivery isolation

### Security
- RBAC and ownership isolation
- Token hashing and rotation
- Rate limiting
- Emergency lock
- Security-version invalidation
- Security headers
- Fail-closed subscription delivery
- Abuse detection
- Audit events for security-sensitive mutations

### Deployment / Operations
- CI typecheck + tests
- D1 migration gate
- Production smoke tests
- Config release migration + CI/deploy verification
- Deployment health checks
- Workers version rollback procedure
- Preview environments with isolated D1/secrets
- Secret rotation procedure
- Incident/diagnostics center
- Observability (Logs + Traces)

### Data / D1
- Append-only migrations
- Expand → migrate → contract for breaking schema changes
- Query/index review
- Version uniqueness constraints
- Ownership-safe queries
- Recovery/backup runbook

### Subscription UX
- Mobile-first subscription page
- Status / expiry / config count
- Copy and QR actions
- Client-aware output
- Diagnostics without leaking sensitive data
- Fast, cache-safe public delivery
- Sakura branding and lightweight animation

### Admin UX
- System health
- Database health
- Security health
- Subscription health
- Deployment status
- Audit timeline
- Diagnostics Center
- Analytics
- Incident Center

## Current implementation status

Already implemented or substantially present:
- D1 + KV Cloudflare-native architecture
- Endpoint removal
- RBAC/auth/session hardening
- D1 rate limiting
- Config generation + validation
- Config version records
- Subscription token hashing/rotation
- Public subscription delivery
- Ownership checks
- Audit storage
- CI/CD with D1 migrations
- Production deployment through GitHub Actions

Next implementation batch:
1. Client compatibility metadata
2. Audit timeline API
3. Backup/restore runbook
4. Preview environment
5. Final dashboard and subscription UI

## Important operational rule

Do not automatically roll back application code after a failed post-deploy check when a database migration has already been applied. First use backward-compatible migrations (expand/migrate/contract), then allow safe Worker-version rollback.

## Benchmarks

BPB demonstrates broad client compatibility and subscription-oriented tooling. SakuraPanel should learn from those capabilities while keeping its own architecture, security model, and codebase.

References used during architecture research:
- Cloudflare Workers/D1 documentation
- BPB Worker Panel
- Nahan
- EdgeTunnel
- Current Cloudflare serverless deployment patterns
