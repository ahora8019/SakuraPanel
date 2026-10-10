# Member Authentication — Implementation Gate

Status: design checkpoint; do not deploy to production.

## Current verified constraints
- The users table currently stores identity, role, status, security_version, and timestamps; it has no password credential fields.
- Owner login currently compares a submitted bootstrap secret to BOOTSTRAP_SECRET. This is not a reusable member authentication flow.
- AuthService already signs short-lived session tokens and stores sessions in auth_sessions.
- authenticateRequest accepts the sp_session cookie or an Authorization Bearer token and validates the session against D1.
- /user is intentionally a static preview with sample data. It must not be changed to display account-specific data until the authenticated API is wired.

## Required implementation sequence
1. Choose a credential provisioning flow before adding a password column:
   - Preferred: owner-created, single-use invitation/reset token with a short expiry; member chooses their password.
   - Never return plaintext passwords or store them in logs.
2. Use Web Crypto PBKDF2-HMAC-SHA-256 with a unique random salt and a deliberately calibrated iteration count; version the credential format so parameters can be upgraded.
3. Add migration fields for password hash/salt/parameters only after the credential flow and compatibility policy are agreed in code. Do not silently make existing users unable to log in.
4. Add POST /user/login with strict content-type/size checks, rate limiting, generic invalid-credential errors, active-user checks, session creation, and HttpOnly; Secure; SameSite=Strict cookie.
5. Add POST /user/logout that revokes the active session and clears the cookie.
6. Add GET /internal/me and GET /internal/my-subscriptions. Derive user ID only from the validated principal; never accept a userId override for MEMBER.
7. Protect cookie-authenticated state-changing endpoints against CSRF (SameSite alone is not the sole control); reject cross-origin mutation requests and validate Origin where appropriate.
8. Add tests for successful and failed login, suspended/disabled users, expiry/revocation, rate limits, CSRF, and cross-member access.
9. Run typecheck and the full test suite in CI, review preview, and only then consider deployment after explicit approval.

## Release gate
No real member data is exposed through the static preview. No production deployment is authorized by this document.
