import { describe, expect, it } from "vitest";
import {
  evaluateCompatibility,
  evaluateCompatibilityMatrix,
  validateCompatibilityMetadata
} from "../src/core/config-compatibility";
import type { GeneratedConfig } from "../src/models/config";

const config: GeneratedConfig = {
  id: "c1", userId: "u1", templateId: "t1", templateVersion: 1, status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  payload: {
    compatibility: {
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["v2rayNG", "NekoBox"],
      features: ["TCP", "REALITY"]
    }
  }
};

describe("config compatibility", () => {
  it("accepts a matching client", () => {
    expect(evaluateCompatibility(config, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"]
    })).toEqual({ compatible: true, reasons: [] });
  });

  it("rejects platform/protocol/client mismatch", () => {
    expect(evaluateCompatibility(config, {
      platform: "IOS", protocol: "VLESS", clients: ["v2rayNG"]
    }).reasons).toContain("platform_mismatch");
    expect(evaluateCompatibility(config, {
      platform: "ANDROID", protocol: "TROJAN", clients: ["v2rayNG"]
    }).reasons).toContain("protocol_mismatch");
    expect(evaluateCompatibility(config, {
      platform: "ANDROID", protocol: "VLESS", clients: ["Streisand"]
    }).reasons).toContain("client_mismatch");
  });

  it("rejects malformed metadata", () => {
    expect(validateCompatibilityMetadata({
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], notes: 123
    })).toContain("compatibility_notes_invalid");
  });

  it("marks unsupported features as partial instead of compatible", () => {
    const result = evaluateCompatibilityMatrix(config, {
      platform: "IOS",
      protocol: "VLESS",
      clients: ["Streisand"]
    });
    expect(result.entries[0]?.status).toBe("partial");
    expect(result.entries[0]?.reasons).toContain("feature_unsupported");
  });

  it("does not treat unknown clients as compatible", () => {
    const result = evaluateCompatibilityMatrix(config, {
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["UnknownClient"]
    });
    expect(result.entries[0]?.status).toBe("unknown");
    expect(result.entries[0]?.reasons).toContain("client_unknown");
  });
});
