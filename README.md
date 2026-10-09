# 🌸 SakuraPanel

<p align="center">
  <strong>A security-first, Cloudflare-native configuration and subscription platform.</strong><br />
  Config lifecycle · Subscription delivery · Cloudflare Workers + D1/KV
</p>

<p align="center">
  <a href="README_fa.md">🇮🇷 فارسی</a> · <a href="README.md">🇬🇧 English</a>
</p>

<p align="center">
  <a href="https://github.com/ahora8019/SakuraPanel/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ahora8019/SakuraPanel/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Cloudflare%20Workers-orange" />
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-yellow" />
</p>

> **Status:** Active development. The default branch is the project baseline; individual features may still be under development or awaiting production verification. A successful CI run is not a production security audit.

SakuraPanel is an independent Cloudflare-native project for managing configuration templates, generated configurations, versioned releases, users, and subscription delivery. It takes inspiration from the operational breadth of existing panels without copying their identity or treating their codebase as its own.

## ✨ Project principles

1. **Security** — least privilege, ownership checks, safe secret handling, and fail-closed behavior.
2. **Stability** — migration discipline, automated checks, and controlled releases.
3. **Performance** — lightweight serverless runtime and efficient data access.
4. **Compatibility** — structured config validation and client compatibility work.
5. **Maintainability** — clear modules, documentation, and repeatable operations.
6. **UX and Sakura identity** — polished, mobile-friendly interfaces with restrained Japanese-inspired styling.

## 🧩 Architecture

```text
Owner / Users
     |
     v
Cloudflare Worker
  ├─ API routing and validation
  ├─ Auth / sessions / RBAC
  ├─ Config generation, versions and releases
  ├─ Subscription delivery and diagnostics
  ├─ Security controls and audit events
  |
  ├───────────────┐
  v               v
Cloudflare D1   Cloudflare KV
application     rate-limit /
data            security state
```

The current edition is designed to run on Cloudflare's serverless platform without a separately managed VPS or custom endpoint service.

## 🛠️ Technology

- TypeScript
- Cloudflare Workers and Wrangler
- Cloudflare D1 (SQL persistence)
- Cloudflare KV (runtime state / configured controls)
- Vitest and TypeScript checks
- GitHub Actions for continuous integration and controlled deployment

## 🚀 Getting started

**Requirements:** Node.js compatible with the repository's CI configuration, npm, and a local checkout. Cloudflare credentials and correctly configured D1/KV bindings are needed only for environment-specific operations.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Before configuring an environment, read:
- [Cloudflare environment guide](docs/cloudflare-environment.md)
- [Production architecture](docs/production-architecture.md)
- [Production runbook](docs/production-runbook.md)

Do not commit API tokens, account credentials, session secrets, bootstrap secrets, or private keys.

## 🤖 Planned Telegram deployment bot

A Telegram bot is planned as a separate operations interface after the Core is stable. It is **planned, not yet claimed as implemented**.

Intended workflow:

```text
Authorized Telegram command
        ↓
Permission check + audit record
        ↓
GitHub Actions checks / tests / migration gate
        ↓
Wrangler deployment
        ↓
Health check + result sent to Telegram
```

Candidate commands: `/deploy`, `/update`, `/status`, `/logs`, `/rollback`, `/health`, and `/version`.

Deployment must require an authorized owner and explicit release gates. Secrets must stay in GitHub/Cloudflare secret storage; never send them through Telegram or commit them to Git. Rollback must account for database migrations and must not be treated as a blind one-click fix.

## 🗺️ Roadmap

See the [SakuraPanel roadmap](docs/sakurapanel-roadmap.md) for implementation priorities. Current roadmap areas include:

- Config validation, versioning, publishing, and rollback
- Secure subscription delivery and diagnostics
- Authentication, RBAC, ownership isolation, and auditability
- D1 migration safety, backup/restore procedures, and preview environments
- Health checks, deployment verification, and operational diagnostics
- Mobile-first subscription and admin experiences
- Telegram-based deployment operations (planned)

## 📚 Documentation

- [Production architecture](docs/production-architecture.md)
- [Cloudflare environment contract](docs/cloudflare-environment.md)
- [Production runbook](docs/production-runbook.md)
- [Product roadmap](docs/sakurapanel-roadmap.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)

## 🔐 Release and security policy

- Run type checks and tests before release.
- Review security-sensitive changes and migration compatibility.
- Keep production credentials in secret storage.
- Deploy only through an explicitly authorized release path.
- Verify health, readiness, logs, and critical flows after deployment.
- Do not claim production readiness or successful deployment without evidence.

For vulnerability reports, follow [SECURITY.md](SECURITY.md).

---

<p align="center">
  <strong>🌸 SakuraPanel · Made in Iran 🇮🇷</strong><br />
  <sub>Independent project. Security first, polish always.</sub>
</p>
