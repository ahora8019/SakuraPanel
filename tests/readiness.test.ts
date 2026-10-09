import { describe, expect, it } from "vitest";
import { runReadiness } from "../src/core/diagnostics";
import type { Env } from "../src/types/env";

function envWith(secret: string, dbAvailable = true): Env {
  const DB = dbAvailable
    ? { prepare: () => ({ first: async () => ({ ok: 1 }) }) }
    : undefined;
  return { AUTH_SECRET: secret, DB } as unknown as Env;
}

describe("readiness checks", () => {
  it("reports ready only when the database and auth secret are configured", async () => {
    const result = await runReadiness(envWith("a".repeat(32)));
    expect(result.ok).toBe(true);
    expect(result.database.status).toBe("ok");
    expect(result.authentication.status).toBe("ok");
  });

  it("does not report ready when the auth secret is missing or too short", async () => {
    const result = await runReadiness(envWith("short"));
    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("ok");
    expect(result.authentication.status).toBe("error");
  });

  it("reports database failure independently of authentication configuration", async () => {
    const result = await runReadiness(envWith("a".repeat(32), false));
    expect(result.ok).toBe(false);
    expect(result.database.status).toBe("error");
    expect(result.authentication.status).toBe("ok");
  });
});
