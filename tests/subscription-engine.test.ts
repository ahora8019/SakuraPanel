import { describe, expect, it } from "vitest";
import { SubscriptionEngine } from "../src/core/subscription-engine";
import type { GeneratedConfig } from "../src/models/config";
import type { Subscription } from "../src/models/subscription";

const subscription: Subscription = {
  id: "sub-1",
  userId: "user-1",
  status: "ACTIVE",
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z"
};

const config = (id: string, endpointId: string): GeneratedConfig => ({
  id,
  userId: "user-1",
  endpointId,
  templateId: "tpl-1",
  templateVersion: 1,
  payload: {},
  status: "ACTIVE",
  createdAt: "2026-10-06T00:00:00.000Z"
});

describe("SubscriptionEngine", () => {
  it("creates a version containing eligible configs", () => {
    const result = new SubscriptionEngine().buildVersion({
      subscription,
      configs: [config("cfg-a", "ep-a"), config("cfg-b", "ep-b")],
      now: "2026-10-06T00:00:00.000Z"
    });

    expect(result.version).toBe(1);
    expect(result.configIds).toEqual(["cfg-a", "cfg-b"]);
  });

  it("rejects inactive subscriptions", () => {
    expect(() =>
      new SubscriptionEngine().buildVersion({
        subscription: { ...subscription, status: "REVOKED" },
        configs: [config("cfg-a", "ep-a")]
      })
    ).toThrow("subscription_not_active");
  });
});