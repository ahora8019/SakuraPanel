import { describe, expect, it } from "vitest";
import { SubscriptionEngine } from "../src/core/subscription-engine";
import type { GeneratedConfig } from "../src/models/config";
import type { Subscription } from "../src/models/subscription";

const subscription: Subscription = {
  id: "sub-1", userId: "user-1", status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
};

const config = (id: string): GeneratedConfig => ({
  id, userId: "user-1", templateId: "tpl-1", templateVersion: 1,
  payload: { id }, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z"
});

describe("SubscriptionEngine", () => {
  it("builds a version from active configs without endpoint infrastructure", () => {
    const version = new SubscriptionEngine().buildVersion({
      subscription,
      configs: [config("cfg-1"), config("cfg-2")],
      now: "2026-01-01T00:01:00.000Z"
    });
    expect(version.configIds).toEqual(["cfg-1", "cfg-2"]);
  });
});
