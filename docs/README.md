# SakuraPanel Documentation

This directory contains the technical and operational documentation for SakuraPanel.

## Start here

| Document | Use it for |
| --- | --- |
| [HTTP API reference](api-reference.md) | Current routes, methods, and behavior |
| [Production architecture](production-architecture.md) | Components, request flow, reliability, and release model |
| [Cloudflare environment contract](cloudflare-environment.md) | Required bindings, secrets, and environment setup |
| [Production runbook](production-runbook.md) | Release gates, post-deploy verification, and recovery |
| [Product roadmap](sakurapanel-roadmap.md) | Capability areas and implementation priorities |

## Source-code navigation

- `src/api/`: HTTP request handlers
- `src/core/`: business logic and domain services
- `src/models/`: domain types
- `src/repositories/`: persistence abstractions and D1 implementations
- `src/security/`: auth, authorization, rate limiting, sessions, and request hardening
- `migrations/`: ordered D1 schema changes
- `tests/`: automated regression and security tests

## Documentation rules

- Describe implemented behavior separately from planned work.
- Do not describe CI success as proof of production deployment.
- Never document live secrets, raw subscription tokens, or private credentials.
- Keep environment requirements consistent with `wrangler.jsonc`, `wrangler.example.jsonc`, and `src/types/env.ts`.
- Treat migrations as append-only once they may have been applied.
