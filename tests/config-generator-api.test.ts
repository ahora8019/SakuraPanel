import { describe, expect, it, vi } from "vitest";
import { ConfigGeneratorApi } from "../src/api/config-generator-api";
import type { SecurityContext } from "../src/security/security-middleware";

const context = {
  principal: { userId: "owner-1", role: "OWNER", sessionId: "session-1", tokenVersion: 1, securityVersion: 1 }
} as SecurityContext;

function responseBody(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("ConfigGeneratorApi", () => {
  it("generates a named subscription and bounded config batch using a matching active template", async () => {
    const template = { id: "template-vless", protocol: "VLESS", status: "ACTIVE" };
    const templates = { list: vi.fn(async () => [template]) };
    const configs = {
      generateBatch: vi.fn(async (input: any) => [{
        id: "config-1", status: "ACTIVE", payload: input.payloadOverrides(1, input.count)
      }, {
        id: "config-2", status: "ACTIVE", payload: input.payloadOverrides(2, input.count)
      }])
    };
    const subscriptions = {
      create: vi.fn(async (_userId: string, _expiresAt?: string, _now?: string, name?: string) => ({
        subscription: { id: "sub-1", name, status: "ACTIVE" },
        accessToken: "opaque-token"
      })),
      recordGeneratedConfigs: vi.fn(async (_id: string, ids: string[]) => ({
        id: "version-1", version: 1, configIds: ids
      }))
    };
    const api = new ConfigGeneratorApi(configs as any, templates as any, subscriptions as any);

    const response = await api.generate(context, {
      protocol: "VLESS", port: 8443, subscriptionName: "Sakura-Test", count: 2
    });
    const body = await responseBody(response);

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.value.subscription.name).toBe("Sakura-Test");
    expect(body.value.subscription.configCount).toBe(2);
    expect(body.value.configs[1].name).toBe("Sakura-Test-2");
    expect(body.value.configs[0].port).toBe(8443);
    expect(subscriptions.recordGeneratedConfigs).toHaveBeenCalledWith("sub-1", ["config-1", "config-2"], expect.any(String));
  });

  it("rejects an out-of-range count before creating a subscription", async () => {
    const subscriptions = { create: vi.fn() };
    const api = new ConfigGeneratorApi({} as any, { list: vi.fn(async () => []) } as any, subscriptions as any);
    const response = await api.generate(context, {
      protocol: "VLESS", port: 443, subscriptionName: "Sakura", count: 101
    });
    expect(response.status).toBe(400);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it("does not create configs when there is no active matching protocol template", async () => {
    const subscriptions = { create: vi.fn() };
    const api = new ConfigGeneratorApi({ generateBatch: vi.fn() } as any, { list: vi.fn(async () => []) } as any, subscriptions as any);
    const response = await api.generate(context, {
      protocol: "VMess", port: 443, subscriptionName: "Sakura", count: 1
    });
    expect(response.status).toBe(404);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });
});
