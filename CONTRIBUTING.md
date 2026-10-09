# Contributing to SakuraPanel

Thank you for helping improve SakuraPanel. The project prioritizes security, correctness, stability, and maintainability over shipping features quickly.

## Development workflow

1. Start from the latest intended base branch.
2. Create a focused feature or fix branch.
3. Keep changes small enough to review.
4. Add or update tests for behavior changes, especially security-sensitive paths.
5. Run all checks listed below.
6. Open a pull request with the motivation, implementation summary, test evidence, risks, and migration impact.
7. Do not merge or deploy until the release checks are satisfied.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm install
npm run typecheck
npm test
npm audit --audit-level=high
```

For local Worker development:

```bash
npm run dev
```

Use local/test bindings for development. Never copy production secrets into local files that may be committed.

## Code guidelines

- Keep HTTP routing in `src/index.ts` and route-specific behavior in `src/api/`.
- Put business rules in `src/core/`, not in route dispatch branches.
- Keep D1 access behind repository abstractions where practical.
- Preserve strict TypeScript settings; do not add `any` as a shortcut.
- Validate untrusted input at system boundaries.
- Keep authorization and ownership checks close to the operation that requires them.
- Return safe error responses; never expose secrets, raw access tokens, or internal stack traces.
- Keep public subscription delivery non-cacheable and fail-closed.
- Prefer additive database migrations. Do not edit a migration that may already have been applied; add a new numbered migration instead.
- Avoid unrelated formatting or refactoring in a bug-fix pull request.

## Testing expectations

Add regression coverage for bug fixes. Security-sensitive changes should consider at least:

- unauthenticated and insufficient-role requests;
- cross-user / cross-owner access;
- expired, inactive, or revoked records;
- malformed input and invalid URL encoding;
- rate-limit and dependency-failure behavior;
- missing bindings and configuration;
- migration/schema consistency.

A passing type check alone is not sufficient evidence for a behavior change.

## Pull request checklist

- [ ] The change has a clear purpose and limited scope.
- [ ] Tests cover the changed behavior and important edge cases.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm audit --audit-level=high` has been reviewed.
- [ ] No secrets, user data, or production tokens are included.
- [ ] Database migration impact is documented, if applicable.
- [ ] Documentation is updated when behavior, configuration, or operations change.
- [ ] Deployment is not triggered as a substitute for testing.

## Security issues

Do not open a public issue containing exploit details or credentials. Follow [SECURITY.md](SECURITY.md).
