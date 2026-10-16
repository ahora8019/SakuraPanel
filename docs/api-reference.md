# SakuraPanel HTTP API Reference

This reference summarizes the routes currently dispatched by `src/index.ts`. The implementation is authoritative if this document and code ever differ.

## General behavior

- Operational endpoints return JSON and use `Cache-Control: no-store`.
- Internal APIs are under `/internal/*` and use the application's authentication/authorization context, except for the explicitly documented bootstrap endpoints.
- Public subscription delivery is a credential-bearing endpoint. Treat its token as a password; responses must remain private and non-cacheable.
- JSON endpoints generally expect JSON request bodies for mutations. Invalid JSON returns a client error.
- Request size limits, same-origin checks for cookie-authenticated mutations, rate limiting, and emergency-lock checks are enforced at the Worker boundary.

## Operational and owner routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Basic Worker health response |
| GET | `/ready` | Readiness checks for D1, authentication secrets, and emergency lock |
| GET | `/owner` | Owner dashboard |
| GET | `/bootstrap` | First-owner bootstrap form |
| POST | `/owner/login` | Create an owner session using the configured bootstrap secret |
| POST | `/owner/logout` | Revoke the current session and clear the session cookie |
| POST | `/internal/bootstrap` | Create the initial OWNER when no users exist; protected by bootstrap secret |
| POST | `/internal/bootstrap/session` | Create an OWNER session using the bootstrap secret |

## Public subscription

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/s/{token}` | Deliver a subscription using its public access token |

The token is high entropy and should be shared only with the intended subscriber. The implementation validates token format, subscription status and expiry, then filters delivered configs according to ownership/status/expiry rules. Optional client compatibility filtering is supported through query parameters handled by the public subscription API.

## Internal API routes

Unless noted otherwise, these routes require a valid application context and must pass role/ownership authorization in the relevant API/service layer.

### System and audit

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/internal/diagnostics` | Operational diagnostics |
| GET | `/internal/audit` | List audit records |

### Users and devices

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/internal/users` | List or create users |
| PATCH | `/internal/users/{userId}/status` | Update user status |
| GET | `/internal/users/{userId}/devices` | List devices belonging to a user |
| POST | `/internal/devices` | Create a device |
| PATCH | `/internal/devices/{deviceId}/status` | Update device status |

### Templates and configs

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/internal/templates` | List or create templates |
| PATCH | `/internal/templates/{templateId}/status` | Update template status |
| POST | `/internal/config-generator` | Generate configs through the generator service |
| GET, POST | `/internal/configs` | List or generate configs |
| GET | `/internal/configs/{configId}` | Get a config |
| GET | `/internal/configs/{configId}/compatibility` | Evaluate config compatibility |
| GET | `/internal/configs/{configId}/releases` | List config releases |
| POST | `/internal/configs/{configId}/releases/publish` | Publish a config release |
| POST | `/internal/configs/{configId}/releases/rollback` | Roll back to a config release |
| PATCH | `/internal/configs/{configId}/status` | Update config status |

### Subscriptions

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/internal/subscriptions` | List or create subscriptions |
| GET | `/internal/subscriptions/{subscriptionId}` | Get a subscription |
| GET | `/internal/subscriptions/{subscriptionId}/diagnostics` | Diagnose subscription integrity |
| POST | `/internal/subscriptions/{subscriptionId}/token/rotate` | Rotate public access token |
| POST | `/internal/subscriptions/{subscriptionId}/provision` | Provision subscription configs |
| POST | `/internal/subscriptions/{subscriptionId}/rebuild` | Rebuild subscription version |
| PATCH | `/internal/subscriptions/{subscriptionId}/status` | Update subscription status |

## Response and error handling

Responses use JSON for most API routes. Error codes are intentionally concise and should not include raw secrets or internal stack traces. Common boundary errors include:

- `not_found`
- `invalid_json` / `invalid_request`
- `validation_failed`
- `unauthorized`
- `forbidden`
- `rate_limited`
- `service_unavailable`
- `request_body_too_large`
- `csrf_rejected`

The exact status and response shape depend on the route and API handler. Review the relevant `src/api/` file before building a client against a specific endpoint.
