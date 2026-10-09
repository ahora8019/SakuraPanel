import { describe, expect, it } from "vitest";
import { runReadiness } from "../src/core/diagnostics";
import type { Env } from "../src/types/env";

function envWith(
  secret: string,
  dbAvailable = true,
  bootstrapSecret = "b".repeat(32),
  kvAvailable = true
): Env {
  const DB = dbAvailable
    ? { prepare: () => ({ first: async () => ({ ok: 1 }) }) }
    : undefined;
  const SECURITY_KV = kvAvailable
    ? { get: async () => null, put: async () => undefined, delete: async () => undefined }
    : undefined;
  return { AUTH_SECRET: secret, BOOTSTRAP_SECRET: bootstrapSecret, DB, SECURITY_KV } as unknown as Env;
}

describe("readiness checks", () => {
  it("reports ready only when database and all critical security controls are configured", async () => {
    const result = await runReadiness(envWith("a".repeat(32)));
    expect(result.ok).toBe(true);
    expect(result.database.status).toBe("ok");
    expect(result.authentication.status).toBe("ok");
    expect(result.bootstrapAuthentication.status).toBe("ok");
    expect(result.emergencyLock.status).toBe("ok");
  });

  it("does not report ready when the auth secret is missing or too short", async () => {
    const result = await runReadiness(envWith("short"));
    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("ok");
    expect(result.authentication.status).toBe("error");
  });

  it("does not report ready when the bootstrap secret is missing or too short", async () => {
    const result = await runReadiness(envWith("a".repeat(32), true, "short"));
    expect(result.ok).toBe(false);
    expect(result.bootstrapAuthentication.status).toBe("error");
  });

  it("does not report ready when emergency-lock storage is missing", async () => {
    const result = await runReadiness(envWith("a".repeat(32), true, "b".repeat(32), false));
    expect(result.ok).toBe(false);
    expect(result.emergencyLock.status).toBe("error");
  });

  it("reports database failure independently of security configuration", async () => {
    const result = await runReadiness(envWith("a".repeat(32), false));
    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("error");
    expect(result.authentication.status).toBe("ok");
    expect(result.bootstrapAuthentication.status).toBe("ok");
    expect(result.emergencyLock.status).toBe("ok");
  });
});
