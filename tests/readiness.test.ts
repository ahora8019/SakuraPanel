import { describe, expect, it } from "vitest";
import { runReadiness } from "../src/core/diagnostics";
import type { Env } from "../src/types/env";

function makeDb(shouldFail = false): D1Database {
  return {
    prepare: () => ({
      first: async () => {
        if (shouldFail) throw new Error("database unavailable");
        return { ok: 1 };
      }
    })
  } as unknown as D1Database;
}

function makeKv(value: string | null = null, shouldFail = false): KVNamespace {
  return {
    get: async () => {
      if (shouldFail) throw new Error("KV unavailable");
      return value;
    }
  } as unknown as KVNamespace;
}

describe("production readiness security controls", () => {
  it("fails readiness when the emergency-lock binding is missing", async () => {
    const result = await runReadiness({
      DB: makeDb()
    } as Env);

    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("ok");
    expect(result.securityControl).toEqual({
      status: "error",
      detail: "security_control_not_configured"
    });
  });

  it("fails readiness while the emergency lock is active", async () => {
    const result = await runReadiness({
      DB: makeDb(),
      SECURITY_KV: makeKv("1")
    } as Env);

    expect(result.ok).toBe(false);
    expect(result.securityControl).toEqual({
      status: "error",
      detail: "emergency_lock_active"
    });
  });

  it("fails readiness when the security state store cannot be read", async () => {
    const result = await runReadiness({
      DB: makeDb(),
      SECURITY_KV: makeKv(null, true)
    } as Env);

    expect(result.ok).toBe(false);
    expect(result.securityControl).toEqual({
      status: "error",
      detail: "security_control_check_failed"
    });
  });

  it("passes readiness only when the database is reachable and the lock is clear", async () => {
    const result = await runReadiness({
      DB: makeDb(),
      SECURITY_KV: makeKv(null)
    } as Env);

    expect(result.ok).toBe(true);
    expect(result.database.status).toBe("ok");
    expect(result.securityControl.status).toBe("ok");
  });

  it("fails readiness when the database is unavailable even if security controls are healthy", async () => {
    const result = await runReadiness({
      DB: makeDb(true),
      SECURITY_KV: makeKv(null)
    } as Env);

    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("error");
    expect(result.securityControl.status).toBe("ok");
  });
});
