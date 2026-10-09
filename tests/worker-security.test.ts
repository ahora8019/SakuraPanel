import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types/env";

const env = {
  AUTH_SECRET: "a".repeat(32),
  BOOTSTRAP_SECRET: "b".repeat(32)
} as unknown as Env;

describe("Worker request security gates", () => {
  it("rejects cross-origin cookie-authenticated mutations before route handling", async () => {
    const response = await worker.fetch(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: {
        cookie: "sp_session=opaque-session",
        origin: "https://attacker.example",
        "content-type": "application/json"
      },
      body: "{}"
    }), env);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "csrf_rejected" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects oversized mutation bodies before route handling", async () => {
    const response = await worker.fetch(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(1_048_577)
    }), env);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: "request_body_too_large" });
  });
});
