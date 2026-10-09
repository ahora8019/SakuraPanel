# 🌸 SakuraPanel

<p align="center">
  <strong>A Cloudflare-native configuration and subscription management platform.</strong><br />
  Security-first architecture · D1 persistence · Worker APIs · Subscription delivery
</p>

<p align="center">
  <a href="https://github.com/ahora8019/SakuraPanel/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ahora8019/SakuraPanel/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-blue" />
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Runtime-Cloudflare%20Workers-orange" />
  <img alt="Status" src="https://img.shields.io/badge/status-pre--deployment-yellow" />
</p>

> **Project status:** Active development. The current feature branch is being tested on GitHub. Production deployment has **not** been verified and must wait until the implementation and release checks are complete.

SakuraPanel is designed as a serverless Cloudflare application for managing users, devices, configuration templates, generated configs, versioned releases, subscriptions, and security-related operations. Its priorities are security, stability, performance, compatibility, and maintainability—in that order.

## Contents

- [What it includes](#what-it-includes)
- [Architecture](#architecture)
- [Repository map](#repository-map)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Development checks](#development-checks)
- [HTTP surface](#http-surface)
- [Security model](#security-model)
- [Documentation](#documentation)
- [Release policy](#release-policy)
- [Current status](#current-status)

## What it includes

- **Cloudflare Worker API** for the application and owner-facing operations.
- **D1 repositories and append-only SQL migrations** for persistent data.
- **Authentication and authorization** with roles, sessions, ownership checks, and security-version handling.
- **Config lifecycle** including template-based generation, validation, version history, publishing, and rollback operations.
- **Subscription lifecycle** including token hashing/rotation, provisioning, delivery, and diagnostics.
- **Security controls** including request-body limits, same-origin checks for cookie-authenticated mutations, rate limiting, emergency lock, and audit records.
- **Operational endpoints** for health and readiness checks.
- **Automated checks** through GitHub Actions.

Features listed here describe code in the repository; they do not imply that a production environment has been deployed or independently verified.

## Architecture

```text
Client / Owner Dashboard
          |
          v
   Cloudflare Worker
          |
          +-- API routing and validation
          +-- Authentication / RBAC / sessions
          +-- Config and release services
          +-- Subscription delivery and diagnostics
          +-- Rate limiting / emergency lock / audit
          |
          +------------------+
          |                  |
          v                  v
     Cloudflare D1      Cloudflare KV
     application data   emergency-lock state
```

The current design does not require a separately managed VPS or endpoint service. Rate-limit buckets are stored in D1; `SECURITY_KV` is used for emergency-lock state.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Worker entry point, routing, request-wide guards, scheduled cleanup |
| `src/api/` | HTTP handlers and API-level request/response behavior |
| `src/core/` | Application services, domain logic, diagnostics, delivery |
| `src/models/` | Domain data models |
| `src/repositories/` | D1 persistence and repository abstractions |
| `src/security/` | Authentication, authorization, sessions, rate limits, hardening |
| `src/templates/` | Template registry |
| `src/types/` | Shared TypeScript types and Worker environment bindings |
| `src/ui/` | Owner dashboard response |
| `tests/` | Unit, integration, security, and schema-integrity tests |
| `migrations/` | Ordered D1 schema migrations; existing migrations should be treated as immutable |
| `scripts/` | Operational scripts, including production smoke tests |
| `.github/workflows/` | CI and manually triggered deployment workflow |
| `docs/` | Architecture, environment contract, roadmap, and operational runbook |
| `wrangler.jsonc` | Active Wrangler configuration for the connected project environment |
| `wrangler.example.jsonc` | Sanitized configuration template for reference |

## Requirements

- Node.js 22 (the CI runtime)
- npm
- A local checkout of this repository
- Cloudflare account, D1 database, and KV namespace only when configuring or deploying an environment

Do not put API tokens, session secrets, bootstrap secrets, or private keys in source files or commit them to Git.

## Getting started

Install dependencies:

```bash
npm install
```

Run the static type check and automated tests:

```bash
npm run typecheck
npm test
```

Start the local Worker:

```bash
npm run dev
```

Local execution may require a valid Wrangler configuration and local bindings. Read [the Cloudflare environment contract](docs/cloudflare-environment.md) before setting up secrets or bindings.

## Development checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Run TypeScript without emitting build files |
| `npm test` | Run the Vitest test suite |
| `npm audit --audit-level=high` | Check installed dependency advisories |
| `npm run dev` | Start Wrangler's local development server |
| `npm run deploy` | Invoke Wrangler deployment; **do not run before the release gate is approved** |

CI runs dependency audit, type checking, and tests. A green CI run verifies those automated checks only; it is not proof that production bindings, migrations, routes, or a live deployment work.

## HTTP surface

The following routes are useful operational entry points:

| Route | Purpose |
| --- | --- |
| `GET /health` | Lightweight Worker health response |
| `GET /ready` | Readiness checks for configured dependencies and required secrets |
| `GET /owner` | Owner dashboard |
| `GET /bootstrap` | First-owner bootstrap page |
| `GET /s/{token}` | Public subscription delivery; token is a credential and must be kept private |
| `/internal/*` | Authenticated internal APIs; exact method and route determine the operation |

Internal API groups cover users, devices, templates, configs, config compatibility, config releases, subscriptions, subscription diagnostics, audit records, and system diagnostics. Consult [the HTTP API reference](docs/api-reference.md), `src/index.ts`, and the corresponding `src/api/` handler for authoritative route behavior.

## Security model

- Keep `AUTH_SECRET` and `BOOTSTRAP_SECRET` in Wrangler/GitHub secret storage, never in Git.
- Use high-entropy secrets of at least 32 characters.
- Keep public subscription responses private and non-cacheable.
- Preserve ownership checks, role checks, token hashing, expiry checks, and fail-closed behavior.
- Do not weaken same-origin protections or rate limits to work around failing requests.
- Treat SQL migrations as production data changes; never assume an application rollback reverses a migration.
- Report suspected vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## Documentation

- [Documentation index](docs/README.md)
- [HTTP API reference](docs/api-reference.md)
- [Architecture overview](docs/production-architecture.md)
- [Cloudflare environment contract](docs/cloudflare-environment.md)
- [Production runbook](docs/production-runbook.md)
- [Product roadmap](docs/sakurapanel-roadmap.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Release policy

SakuraPanel follows this order:

1. Implement and review changes on a feature branch.
2. Run CI: dependency audit, type check, and tests.
3. Review security-sensitive paths and migration compatibility.
4. Verify configuration and secrets without exposing them.
5. Approve the release explicitly.
6. Apply migrations and deploy only when authorized.
7. Verify health, readiness, authenticated flows, logs, and smoke tests.

The GitHub deployment workflow is intentionally manual. **Do not deploy simply to see whether a change works.** Test first, deploy only after the project release gate is satisfied, and never claim a live deployment without checking the live environment.

## Current status

- Development branch: `feat/compatibility-matrix`
- CI: automated validation is configured; check the Actions tab for the latest result.
- Production: not confirmed as deployed by this documentation change.
- Merge and deployment: not performed by this repository-organization update.
