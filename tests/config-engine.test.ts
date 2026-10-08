import { describe, expect, it } from "vitest";
import { ConfigEngine } from "../src/core/config-engine";
import { validateGeneratedConfig } from "../src/core/config-validation";
import type { ConfigTemplate } from "../src/models/template";

const template: ConfigTemplate = {
  id: "tpl-1", name: "default", protocol: "generic", version: 1,
  definition: { mode: "default" }, status: "ACTIVE",
  createdAt: "2026-10-06T00:00:00.000Z", updatedAt: "2026-10-06T00:00:00.000Z"
};

describe("ConfigEngine", () => {
  it("generates a config from template + identity without an endpoint", () => {
    const config = new ConfigEngine().generate({
      identity: { userId: "user-1", deviceId: "device-1" },
      template,
      expiresAt: "2026-12-01T00:00:00.000Z",
      now: "2026-10-06T00:00:00.000Z"
    });

    expect(config.userId).toBe("user-1");
    expect(config.templateId).toBe("tpl-1");
    expect(config).not.toHaveProperty("endpointId");
    expect(config.payload).toMatchObject({
      identity: { userId: "user-1", deviceId: "device-1" }
    });
    expect(validateGeneratedConfig(config).valid).toBe(true);
  });

  it("rejects inactive templates", () => {
    expect(() => new ConfigEngine().generate({
      identity: { userId: "user-1" },
      template: { ...template, status: "DISABLED" }
    })).toThrow("template_not_active");
  });
});
