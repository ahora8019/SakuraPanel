# SakuraPanel — Architecture Status

## Production architecture

```
Client
  ↓
Cloudflare Worker
  ├── Auth / RBAC
  ├── Config Engine
  ├── Subscription Engine
  ├── Security / Rate Limit
  ├── Audit
  └── Diagnostics
       ↓
      D1
       +
   Security KV
```

There is intentionally no Endpoint/VPS service in the current architecture.

## Reliability model

```
Change
 ↓
Typecheck
 ↓
Unit/Integration Tests
 ↓
D1 Migration
 ↓
Worker Deploy
 ↓
Smoke Tests
 ↓
Observe
```

Database changes must prefer:

```
EXPAND → DEPLOY → BACKFILL → SWITCH → CONTRACT
```

## Release model

A config is generated from:
- User identity
- Optional device identity
- Template
- Template version
- Expiration

The generated config is validated before persistence. Subscription versions reference config IDs, allowing historical versions and controlled rebuilds.

Future release abstraction:
- Draft
- Validated
- Published
- Superseded
- Rolled back

## Public subscription security

Public tokens are high-entropy random values. Only a SHA-256 hash is persisted. The raw access token is returned only at creation/rotation time.

Public delivery must remain:
- no-store
- rate-limited
- fail-closed
- ownership-safe
- free of internal token/hash data

## Diagnostics design

Diagnostics must expose health state, not secrets.

Example:

```json
{
  "ok": true,
  "service": "sakurapanel",
  "checks": {
    "database": "ok",
    "schema": "ok",
    "security": "ok"
  }
}
```

A future authenticated diagnostics endpoint can add:
- migration state
- table/index checks
- config validation status
- subscription health
- recent deployment metadata
- audit/security warnings

## Compatibility

Future client metadata should describe which generated formats are supported by:
- Xray
- Sing-box
- Clash/Mihomo
- WireGuard
- other supported clients

Compatibility must be data-driven rather than hard-coded into the UI.

## Observability

Production should use:
- Workers Logs
- Traces
- structured JSON logs
- request correlation IDs
- explicit error codes
- no secrets in logs

## Backup and recovery

Backup/restore procedures belong in the operational runbook. Recovery must distinguish:
- application rollback
- Worker version rollback
- D1 corrective migration
- data restoration

A destructive D1 rollback must never be treated as equivalent to an application rollback.
