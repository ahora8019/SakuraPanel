import { describe, expect, it } from "vitest";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";
import type { SecurityContext } from "../src/security/security-middleware";
import type { Env } from "../src/types/env";
import { V1SystemsApi } from "../src/api/v1-systems-api";
import type { GeneratedConfig } from "../src/models/config";

const ownConfig: GeneratedConfig = {
  id: "config-1",
  userId: "member-1",
  templateId: "template-1",
  templateVersion: 1,
  payload: { uri: "vless://11111111-1111-4111-8111-111111111111@example.com:443" },
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z"
};

function context(role: "OWNER" | "ADMIN" | "MEMBER", userId: string): SecurityContext {
  return { principal: { userId, role, sessionId: "session-1", tokenVersion: 1, securityVersion: 1, issuedAt: 1, expiresAt: 9999999999 } };
}

describe("v1 systems API authorization", () => {
  it("forces MEMBER Config Studio reads to the authenticated user's data", async () => {
    const requestedUsers: string[] = [];
    const configs = {
      listByUserId: async (userId: string) => { requestedUsers.push(userId); return [ownConfig]; }
    } as unknown as ConfigRepository;
    const api = new V1SystemsApi(configs, {} as SubscriptionRepository);
    const response = await api.configStudio(context("MEMBER", "member-1"), {} as Env, new URLSearchParams("format=json&userId=other-user"));
    const body = await response.json() as { ok: boolean; value: { count: number } };
    expect(response.status).toBe(200);
    expect(requestedUsers).toEqual(["member-1"]);
    expect(body.value.count).toBe(1);
  });

  it("lists filterable config metadata without returning payloads", async () => {
    const configs = {
      listByUserId: async () => [ownConfig]
    } as unknown as ConfigRepository;
    const api = new V1SystemsApi(configs, {} as SubscriptionRepository);
    const response = await api.configStudio(context("MEMBER", "member-1"), {} as Env, new URLSearchParams("format=inspect"));
    const body = await response.json() as { value: { items: Array<Record<string, unknown>> } };
    expect(response.status).toBe(200);
    expect(body.value.items[0].state).toBe("active");
    expect(body.value.items[0].payload).toBeUndefined();
  });

  it("exports only selected config IDs and validates their ownership", async () => {
    let requested: string[] = [];
    const configs = {
      listByIds: async (ids: string[]) => { requested = ids; return [ownConfig]; }
    } as unknown as ConfigRepository;
    const api = new V1SystemsApi(configs, {} as SubscriptionRepository);
    const response = await api.configStudio(context("MEMBER", "member-1"), {} as Env, new URLSearchParams("format=json&ids=config-1"));
    const body = await response.json() as { value: { count: number } };
    expect(response.status).toBe(200);
    expect(requested).toEqual(["config-1"]);
    expect(body.value.count).toBe(1);
  });

  it("rejects unauthenticated Pulse requests server-side", async () => {
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.pulse(null, {} as Env);
    expect(response.status).toBe(403);
  });

  it("does not expose another user's subscription to a MEMBER", async () => {
    let configRead = false;
    const configs = {
      listByIds: async () => { configRead = true; return []; }
    } as unknown as ConfigRepository;
    const subscriptions = {
      findById: async () => ({ id: "sub-other", userId: "other-user", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" })
    } as unknown as SubscriptionRepository;
    const api = new V1SystemsApi(configs, subscriptions);
    const response = await api.configStudio(context("MEMBER", "member-1"), {} as Env, new URLSearchParams("format=subscription&subscriptionId=sub-other&userId=other-user"));
    expect(response.status).toBe(404);
    expect(configRead).toBe(false);
  });

  it("reports never_executed when scheduled Pulse history is empty", async () => {
    const db = {
      prepare() {
        return {
          bind() { return this; },
          async first() { return null; },
          async all() { return { results: [] }; }
        };
      }
    } as unknown as D1Database;
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.pulseHistory(context("OWNER", "owner-1"), { DB: db } as Env, new URLSearchParams("limit=10"));
    const body = await response.json() as { value: { executionState: string; count: number; lastSuccessfulAt: string | null } };
    expect(response.status).toBe(200);
    expect(body.value.executionState).toBe("never_executed");
    expect(body.value.count).toBe(0);
    expect(body.value.lastSuccessfulAt).toBeNull();
  });

  it("rejects unbounded Pulse history limits", async () => {
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.pulseHistory(context("OWNER", "owner-1"), { DB: {} as D1Database } as Env, new URLSearchParams("limit=1000"));
    expect(response.status).toBe(400);
  });

  it("returns insufficient data rather than inventing routes", async () => {
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.routeAdvisor(context("OWNER", "owner-1"), {} as Env);
    const body = await response.json() as { value: { decision: string; candidates: unknown[] } };
    expect(response.status).toBe(200);
    expect(body.value.decision).toBe("insufficient_data");
    expect(body.value.candidates).toEqual([]);
  });
});
