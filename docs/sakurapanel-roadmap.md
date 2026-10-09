# SakuraPanel — Next-Generation Roadmap

## Product principles

SakuraPanel is an independent Cloudflare-native project. Other projects may be used as functional benchmarks, not as code or identity to copy.

Priorities, in order:

1. Security
2. Stability
3. Performance
4. Compatibility
5. Maintainability
6. UX and visual polish

The current edition does not require a separately managed VPS or endpoint service.

## Capability areas

### Core / backend
- Config validation and template-based generation
- Config versioning, release publishing, and rollback
- Subscription delivery hardening and token lifecycle
- Subscription diagnostics and integrity checks
- Client compatibility metadata and evaluation
- Request IDs, structured logs, health/readiness checks
- Audit timeline and role-based access control
- Backup/restore procedures and published-version isolation

### Security
- RBAC and ownership isolation
- Token hashing and rotation
- Rate limiting and abuse detection
- Emergency lock
- Security-version invalidation
- Security headers and request hardening
- Fail-closed subscription delivery
- Audit events for security-sensitive mutations

### Deployment / operations
- CI dependency audit, typecheck, and tests
- D1 migration review and release gates
- Production smoke tests and health checks
- Worker-version recovery procedure
- Isolated preview environments
- Secret rotation procedure
- Incident and diagnostics workflow
- Logs and traces

### Data / D1
- Append-only migrations
- Expand → migrate → contract for breaking schema changes
- Query and index review
- Version uniqueness constraints
- Ownership-safe queries
- Verified backup and restore procedure

### Subscription UX
- Mobile-first subscription page
- Status, expiry, and config count
- Copy and QR actions
- Client-aware output formats
- Diagnostics that do not leak sensitive data
- Fast, cache-safe public delivery
- Sakura branding and lightweight animation

### Admin UX
- System, database, and security health
- Subscription health
- Audit timeline
- Diagnostics and incident center
- Deployment status and analytics

## Implementation status

The repository contains implementation for several core capabilities, including the Cloudflare Worker entry point, D1 repositories and migrations, authentication/session handling, access-control checks, rate limiting, config generation and validation, config releases, subscription token handling and delivery, audit records, diagnostics, and CI workflows.

This is a source-code inventory, not a claim that every capability has passed a production acceptance test. Production deployment and live-environment verification remain separate release activities.

### Current engineering focus

1. Improve D1 query efficiency without weakening ownership, status, or expiry checks.
2. Expand regression tests for security boundaries and edge cases.
3. Review schema/index alignment and migration safety.
4. Improve repository documentation and contributor workflow.
5. Complete a release-readiness review before any production deployment.

### Later priorities

- Verified backup and restore workflow
- Isolated preview environment
- Subscription and owner dashboard UX improvements
- More comprehensive operational metrics and incident handling

## Release invariant

Do not automatically roll back application code after a failed post-deploy check if a database migration has already been applied. First design backward-compatible migrations (expand/migrate/contract), then permit a safe Worker-version rollback only when the schema remains compatible.

## Benchmarks

External projects can help identify expected capabilities such as client compatibility and subscription tooling. SakuraPanel should implement its own requirements and maintain its own security model and codebase.
