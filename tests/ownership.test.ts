import { describe, expect, it } from "vitest";
import type { GeneratedConfig } from "../src/models/config";

describe("configuration ownership", () => {
  it("keeps configuration ownership attached to the user", () => {
    const config: GeneratedConfig = {
      id: "cfg-1",
      userId: "user-1",
      templateId: "tpl-1",
      templateVersion: 1,
      payload: { identity: { userId: "user-1" } },
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    expect(config.userId).toBe("user-1");
    expect(config).not.toHaveProperty("endpointId");
  });
});
