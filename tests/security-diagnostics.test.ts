import { describe, expect, it } from "vitest";
import { runDiagnostics } from "../src/core/diagnostics";
import type { Env } from "../src/types/env";

const tableNames = [
  "users", "devices", "templates", "configs", "config_versions", "config_releases",
  "subscriptions", "subscription_versions", "audit_logs", "auth_sessions", "rate_limit_buckets"
];

function envWithSecurity(kvAvailable = true): Env {
  const DB = {
    prepare: (sql: string) => ({
      first: async () => ({ ok: 1 }),
      all: async () => ({
        results: sql.includes("sqlite_master")
          ? tableNames.map(name => ({ name }))
          : []
      })
    })
  };
  const SECURITY_KV = kvAvailable
    ? { get: async () => null, put: async () => undefined, delete: async () => undefined }
    : undefined;
  return {
    AUTH_SECRET: "a".repeat(32),
    BOOTSTRAP_SECRET: "b".repeat(32),
    DB,
    SECURITY_KV
  } as unknown as Env;
}

describe("security diagnostics", () => {
  it("reports healthy schema only when required security controls are configured", async () => {
    const result = await runDiagnostics(envWithSecurity());
    expect(result.ok).toBe(true);
    expect(result.checks.authentication.status).toBe("ok");
    expect(result.checks.bootstrapAuthentication.status).toBe("ok");
    expect(result.checks.emergencyLock.status).toBe("ok");
  });

  it("fails closed when emergency-lock storage is absent", async () => {
    const result = await runDiagnostics(envWithSecurity(false));
    expect(result.ok).toBe(false);
    expect(result.checks.database.status).toBe("ok");
    expect(result.checks.emergencyLock).toEqual({
      status: "error",
      detail: "security_kv_not_configured"
    });
  });
});
