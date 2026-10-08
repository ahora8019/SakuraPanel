import { describe, expect, it } from "vitest";
import { ConfigApi } from "../src/api/config-api";
import { SubscriptionApi } from "../src/api/subscription-api";
import { DeviceApi } from "../src/api/device-api";
import type { SecurityContext } from "../src/security/security-middleware";

const member: SecurityContext = {
  principal: {
    userId: "user-1",
    role: "MEMBER",
    sessionId: "s1",
    tokenVersion: 1,
    securityVersion: 1,
    issuedAt: 1000,
    expiresAt: 2000
  }
};

const otherConfig = {
  id: "cfg-2",
  userId: "user-2",
  endpointId: "ep-1",
  templateId: "tpl-1",
  templateVersion: 1,
  payload: {},
  status: "ACTIVE" as const,
  createdAt: "2026-10-06T00:00:00.000Z"
};

const otherSubscription = {
  id: "sub-2",
  userId: "user-2",
  status: "ACTIVE" as const,
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z"
};

describe("API ownership / IDOR protection", () => {
  it("hides another user's config as not_found", async () => {
    const service = {
      get: async () => otherConfig
    } as any;
    const response = await new ConfigApi(service).get(member, "cfg-2");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("hides another user's subscription as not_found", async () => {
    const service = {
      get: async () => otherSubscription
    } as any;
    const response = await new SubscriptionApi(service).get(member, "sub-2");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("prevents a member from listing another user's devices", async () => {
    const service = {
      listForUser: async () => []
    } as any;
    const response = await new DeviceApi(service).list(member, "user-2");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("prevents a member from creating a device for another user", async () => {
    const service = { create: async () => { throw new Error("should_not_call"); } } as any;
    const response = await new DeviceApi(service).create(member, {
      userId: "user-2",
      name: "attacker-device"
    });

    expect(response.status).toBe(404);
  });
});
