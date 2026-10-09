import { describe, expect, it } from "vitest";
import { parseCompatibilityTarget } from "../src/core/compatibility-target";

describe("compatibility target query parser", () => {
  it("parses a valid target with optional features", () => {
    expect(parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS&client=v2rayNG&client=NekoBox&feature=TCP"
    ))).toEqual({
      platform: "ANDROID",
      protocol: "VLESS",
      clients: ["v2rayNG", "NekoBox"],
      features: ["TCP"]
    });
  });

  it("rejects unknown query parameters", () => {
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS&client=v2rayNG&debug=true"
    ))).toThrow("validation_failed");
  });

  it("rejects duplicate scalar fields", () => {
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&platform=IOS&protocol=VLESS&client=v2rayNG"
    ))).toThrow("validation_failed");
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS&protocol=VMESS&client=v2rayNG"
    ))).toThrow("validation_failed");
  });

  it("rejects duplicate clients and features", () => {
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS&client=v2rayNG&client=v2rayNG"
    ))).toThrow("validation_failed");
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS&client=v2rayNG&feature=TCP&feature=TCP"
    ))).toThrow("validation_failed");
  });

  it("rejects missing clients and invalid enum values", () => {
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=ANDROID&protocol=VLESS"
    ))).toThrow("validation_failed");
    expect(() => parseCompatibilityTarget(new URLSearchParams(
      "platform=UNKNOWN&protocol=VLESS&client=v2rayNG"
    ))).toThrow("validation_failed");
  });
});
