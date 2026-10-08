import { describe, expect, it } from "vitest";
import { validateGeneratedConfig } from "../src/core/config-validation";
import type { GeneratedConfig } from "../src/models/config";

const base: GeneratedConfig = {
  id: "cfg-1",
  userId: "user-1",
  templateId: "tpl-1",
  templateVersion: 1,
  payload: { mode: "default" },
  status: "ACTIVE",
  createdAt: "2026-10-06T00:00:00.000Z"
};

describe("config validation", () => {
  it("keeps compatibility metadata optional for legacy configs", () => {
    expect(validateGeneratedConfig(base)).toEqual({ valid: true, errors: [] });
  });

  it("accepts valid compatibility metadata", () => {
    expect(validateGeneratedConfig({
      ...base,
      payload: {
        compatibility: {
          platform: "ANDROID",
          protocol: "VLESS",
          clients: ["v2rayNG"],
          minVersion: "1.9.0"
        }
      }
    })).toEqual({ valid: true, errors: [] });
  });

  it("rejects invalid compatibility metadata", () => {
    const result = validateGeneratedConfig({
      ...base,
      payload: {
        compatibility: {
          platform: "ANDROID",
          protocol: "INVALID",
          clients: ["v2rayNG"]
        }
      }
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("compatibility_protocol_invalid");
  });
});
