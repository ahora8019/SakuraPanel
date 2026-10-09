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
    const iosConfig: GeneratedConfig = {
      ...config,
      payload: {
        compatibility: {
          platform: "IOS",
          protocol: "VLESS",
          clients: ["Streisand"],
          features: ["REALITY"]
        }
      }
    };
    const result = evaluateCompatibilityMatrix(iosConfig, {
      platform: "IOS",
      protocol: "VLESS",
      clients: ["Streisand"]
    });
    expect(result.entries[0]?.status).toBe("partial");
    expect(result.entries[0]?.reasons).toContain("feature_unsupported");
  });

  it("rejects a client that is not declared by the config", () => {
    const result = evaluateCompatibilityMatrix(config, {
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["Hiddify"]
    });
    expect(result.entries[0]?.status).toBe("incompatible");
    expect(result.entries[0]?.reasons).toContain("client_not_declared");
  });

  it("rejects a target that does not match config metadata", () => {
    const result = evaluateCompatibilityMatrix(config, {
      platform: "IOS",
      protocol: "VLESS",
      clients: ["v2rayNG"]
    });
    expect(result.entries[0]?.status).toBe("incompatible");
    expect(result.entries[0]?.reasons).toContain("platform_mismatch");
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
  it("does not claim requested features that the config does not declare", () => {
    const result = evaluateCompatibilityMatrix(config, {
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["v2rayNG"],
      features: ["WEBSOCKET"]
    });
    expect(result.entries[0]?.status).toBe("partial");
    expect(result.entries[0]?.reasons).toContain("config_feature_missing");
    expect(result.entries[0]?.unsupportedFeatures).toContain("WEBSOCKET");
  });

  it("marks requested feature support unknown when config metadata omits features", () => {
    const configWithoutFeatures: GeneratedConfig = {
      ...config,
      payload: {
        compatibility: {
          platform: "ANDROID",
          protocol: "VLESS",
          clients: ["v2rayNG"]
        }
      }
    };
    const result = evaluateCompatibilityMatrix(configWithoutFeatures, {
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["v2rayNG"],
      features: ["REALITY"]
    });
    expect(result.entries[0]?.status).toBe("unknown");
    expect(result.entries[0]?.reasons).toContain("config_features_unknown");
  });

  it("honors requested features in the basic compatibility evaluator", () => {
    expect(evaluateCompatibility(config, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], features: ["WEBSOCKET"]
    })).toEqual({ compatible: false, reasons: ["feature_mismatch"] });

    const noFeatureMetadata: GeneratedConfig = {
      ...config,
      payload: { compatibility: { platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"] } }
    };
    expect(evaluateCompatibility(noFeatureMetadata, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], features: ["TCP"]
    })).toEqual({ compatible: false, reasons: ["compatibility_features_unknown"] });
  });

  it("checks minimum client version instead of claiming unsupported versions compatible", () => {
    const versionedConfig: GeneratedConfig = {
      ...config,
      payload: {
        compatibility: {
          platform: "ANDROID",
          protocol: "VLESS",
          clients: ["v2rayNG"],
          features: ["TCP"],
          minVersion: "2.1.0"
        }
      }
    };

    const tooOld = evaluateCompatibilityMatrix(versionedConfig, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], clientVersion: "2.0.9"
    });
    expect(tooOld.entries[0]?.status).toBe("incompatible");
    expect(tooOld.entries[0]?.reasons).toContain("client_version_too_old");

    const unknownVersion = evaluateCompatibilityMatrix(versionedConfig, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"]
    });
    expect(unknownVersion.entries[0]?.status).toBe("unknown");
    expect(unknownVersion.entries[0]?.reasons).toContain("client_version_required");

    const supported = evaluateCompatibilityMatrix(versionedConfig, {
      platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], clientVersion: "2.1.0"
    });
    expect(supported.entries[0]?.status).toBe("compatible");
  });

});
