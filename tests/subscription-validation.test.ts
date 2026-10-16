import { describe, expect, it } from "vitest";
import { validateSubscriptionVersion } from "../src/core/subscription-validation";
import type { SubscriptionVersion } from "../src/models/subscription";

const base: SubscriptionVersion = {
  id: "v1",
  subscriptionId: "s1",
  version: 1,
  configIds: ["c1"],
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("subscription version validation", () => {
  it("rejects non-integer versions", () => {
    expect(validateSubscriptionVersion({ ...base, version: 1.5 })).toContain("invalid_version");
  });

  it("rejects duplicate config IDs", () => {
    expect(validateSubscriptionVersion({ ...base, configIds: ["c1", "c1"] })).toContain("duplicate_config_ids");
  });

  it("rejects versions beyond the public delivery limit", () => {
    expect(validateSubscriptionVersion({
      ...base,
      configIds: Array.from({ length: 101 }, (_, i) => `c${i}`)
    })).toContain("config_limit_exceeded");
  });

  it("rejects malformed creation timestamps", () => {
    expect(validateSubscriptionVersion({ ...base, createdAt: "invalid" })).toContain("invalid_created_at");
  });
});
