# Security Policy

Security is a primary design requirement for SakuraPanel. Please report suspected vulnerabilities responsibly.

## Supported status

SakuraPanel is under active development. A passing CI run does not mean the application has been independently audited or verified in production.

## Reporting a vulnerability

**Do not publish exploit steps, live subscription tokens, authentication secrets, personal data, or production identifiers in a public issue.**

Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If private reporting is unavailable, contact the repository maintainer through a private channel before sharing technical details publicly.

Include, where safe:

- affected component or route;
- impact and prerequisites;
- minimal reproduction steps;
- a suggested mitigation, if known.

Do not access, modify, or delete data belonging to other users while validating a report.

## Secret exposure

If a secret or token is committed or otherwise exposed:

1. Revoke or rotate it immediately using the provider's control panel.
2. Check logs and audit records for suspicious use.
3. Remove the exposed value from active code and configuration.
4. Remember that deleting a value in a later commit does not remove it from Git history.
5. Do not paste the secret into an issue, pull request, or chat.

## Security invariants

Changes must preserve:

- role-based authorization and ownership isolation;
- secure session validation and revocation;
- hashed public subscription tokens and token rotation;
- expiry and active-status checks;
- request size limits and same-origin protections for cookie-authenticated mutations;
- rate limiting and emergency-lock behavior;
- non-cacheable responses for secret-bearing subscription content;
- safe diagnostics and audit metadata that do not leak credentials.

## Release caution

Database migrations are persistent data changes. A Worker rollback does not reverse a D1 migration. Use backward-compatible migration strategies and the production runbook.
