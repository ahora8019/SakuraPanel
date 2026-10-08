import { describe, expect, it, vi } from "vitest";
import { PublicSubscriptionApi } from "../src/api/public-subscription-api";
import type { PublicSubscriptionSnapshot } from "../src/core/subscription-delivery";
import type { SubscriptionDeliveryService } from "../src/core/subscription-delivery";

function snapshot(): PublicSubscriptionSnapshot {
  return {
    subscriptionId: "sub-1",
    version: 7,
    expiresAt: "2026-12-01T00:00:00.000Z",
    configs: [{
      id: "cfg-1",
      userId: "user-1",
      templateId: "tpl-1",
      templateVersion: 2,
      payload: { protocol: "vless" },
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z"
    }]
  };
}

function apiWith(result: PublicSubscriptionSnapshot | Error) {
  const getSnapshot = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    api: new PublicSubscriptionApi({ getSnapshot } as unknown as SubscriptionDeliveryService),
    getSnapshot
  };
}

describe("public subscription API reliability", () => {
  it("returns a non-cacheable snapshot with security headers", async () => {
    const { api, getSnapshot } = apiWith(snapshot());
    const response = await api.get("A".repeat(43));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    const body = await response.json() as { ok: true; value: { version: number } };
    expect(body.value.version).toBe(7);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown query parameters and duplicate scalar target fields", async () => {
    const { api, getSnapshot } = apiWith(snapshot());

    const unknown = await api.get("A".repeat(43), new URLSearchParams("foo=bar"));
    expect(unknown.status).toBe(400);

    const duplicate = await api.get(
      "A".repeat(43),
      new URLSearchParams("platform=ANDROID&platform=IOS&protocol=VLESS&client=v2rayNG")
    );
    expect(duplicate.status).toBe(400);

    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("rejects duplicate client and feature values", async () => {
    const { api } = apiWith(snapshot());

    const clients = await api.get(
      "A".repeat(43),
      new URLSearchParams("platform=ANDROID&protocol=VLESS&client=v2rayNG&client=v2rayNG")
    );
    expect(clients.status).toBe(400);

    const features = await api.get(
      "A".repeat(43),
      new URLSearchParams("platform=ANDROID&protocol=VLESS&client=v2rayNG&feature=TCP&feature=TCP")
    );
    expect(features.status).toBe(400);
  });

  it("maps expired and empty subscriptions to the same public 404", async () => {
    for (const error of [new Error("subscription_expired"), new Error("no_eligible_configs")]) {
      const { api } = apiWith(error);
      const response = await api.get("A".repeat(43));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ ok: false, error: "not_found" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("never exposes internal failures as internal error details", async () => {
    const { api } = apiWith(new Error("D1 constraint details"));
    const response = await api.get("A".repeat(43));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "internal_error" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
