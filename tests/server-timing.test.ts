import { describe, expect, it } from "vitest";
import { ConfigApi } from "../src/api/config-api";
import { SubscriptionApi } from "../src/api/subscription-api";
import type { ConfigService } from "../src/core/config-service";
import type { SubscriptionService } from "../src/core/subscription-service";
import type { SecurityContext } from "../src/security/security-middleware";

const owner: SecurityContext = {
  principal: {
    userId: "owner-1",
    role: "OWNER",
    sessionId: "session-1",
    tokenVersion: 1,
    securityVersion: 1,
    issuedAt: 1,
    expiresAt: 9999999999
  }
};

describe("Sakura Speed Lab server timing", () => {
  it("exposes bounded server-side duration for actual config generation without adding payload fields", async () => {
    const api = new ConfigApi({
      generate: async () => ({ id: "cfg-1", userId: "owner-1", payload: { uri: "vless://example" } })
    } as unknown as ConfigService);

    const response = await api.generate(owner, { userId: "owner-1", templateId: "template-1" });
    expect(response.status).toBe(201);
    expect(response.headers.get("server-timing")).toMatch(/^config_generate;dur=\\d+(?:\\.\\d+)?$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { value: Record<string, unknown> };
    expect(body.value.id).toBe("cfg-1");
    expect(body.value.serverTiming).toBeUndefined();
  });

  it("exposes server-side duration for real subscription provisioning and does not expose service internals", async () => {
    const api = new SubscriptionApi({
      get: async () => ({ id: "sub-1", userId: "owner-1", status: "ACTIVE" }),
      provision: async () => ({ version: 3, configCount: 2 })
    } as unknown as SubscriptionService);

    const response = await api.provision(owner, "sub-1", { templateId: "template-1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("server-timing")).toMatch(/^subscription_provision;dur=\\d+(?:\\.\\d+)?$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { value: Record<string, unknown> };
    expect(body.value.version).toBe(3);
    expect(JSON.stringify(body)).not.toContain("accessToken");
  });
});
