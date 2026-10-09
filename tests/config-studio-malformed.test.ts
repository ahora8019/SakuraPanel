import { describe, expect, it } from "vitest";
import { D1ConfigRepository } from "../src/repositories/config-repository";
import { inspectConfig } from "../src/core/v1-systems";

function repositoryWithPayload(payload: string): D1ConfigRepository {
  const row = {
    id: "config-1",
    user_id: "user-1",
    device_id: null,
    template_id: "template-1",
    template_version: 1,
    status: "ACTIVE",
    expires_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    payload
  };
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return row; }
      };
    }
  };
  return new D1ConfigRepository(db as unknown as D1Database);
}

describe("Config Studio malformed stored data handling", () => {
  it("marks malformed JSON payloads invalid without exposing the marker", async () => {
    const config = await repositoryWithPayload("{not-json").findById("config-1");
    expect(config).not.toBeNull();
    expect(inspectConfig(config!).state).toBe("invalid");
    expect(JSON.stringify(config!.payload)).not.toContain("__sakurapanelInvalidPayload");
  });

  it("marks non-object JSON payloads invalid", async () => {
    const config = await repositoryWithPayload("[1,2,3]").findById("config-1");
    expect(config).not.toBeNull();
    expect(inspectConfig(config!).state).toBe("invalid");
  });
});
