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


  it("ranks only fresh persisted route health evidence and never mutates routing", async () => {
    const measuredAt = new Date().toISOString();
    let query = "";
    let bound: unknown[] = [];
    const db = {
      prepare(sql: string) {
        query = sql;
        return {
          bind(...values: unknown[]) { bound = values; return this; },
          async all() {
            return { results: [{
              id: "route-fast",
              compatible: 1,
              healthy: 1,
              latency_ms: 35,
              error_rate: 0.01,
              sample_count: 4,
              measured_at: measuredAt
            }] };
          }
        };
      }
    } as unknown as D1Database;
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.routeAdvisor(context("OWNER", "owner-1"), { DB: db } as Env);
    const body = await response.json() as { value: { decision: string; source: string; candidates: Array<{ id: string; score: number | null }> } };
    expect(response.status).toBe(200);
    expect(body.value.decision).toBe("recommendation");
    expect(body.value.source).toBe("d1_route_health_samples");
    expect(body.value.candidates[0].id).toBe("route-fast");
    expect(body.value.candidates[0].score).not.toBeNull();
    expect(query).toContain("route_health_samples");
    expect(query).toContain("LIMIT 50");
    expect(bound).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed when the Route Advisor schema is not available", async () => {
    const db = {
      prepare() {
        return {
          bind() { return this; },
          async all() { throw new Error("no such table: route_candidates"); }
        };
      }
    } as unknown as D1Database;
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.routeAdvisor(context("OWNER", "owner-1"), { DB: db } as Env);
    const body = await response.json() as { error: string; value: { decision: string; candidates: unknown[] } };
    expect(response.status).toBe(503);
    expect(body.error).toBe("route_candidate_model_unavailable");
    expect(body.value.decision).toBe("insufficient_data");
    expect(body.value.candidates).toEqual([]);
  });


  it("returns a bounded non-sensitive history summary for real operation timings", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async first() { return { ok: 1 }; },
          async all() {
            if (sql.includes("operation_timing_samples")) {
              return { results: [
                { operation: "config_generate", measured_at: "2026-10-09T12:02:00.000Z", duration_ms: 12 },
                { operation: "config_generate", measured_at: "2026-10-09T12:01:00.000Z", duration_ms: 10 },
                { operation: "subscription_provision", measured_at: "2026-10-09T12:00:00.000Z", duration_ms: 20 }
              ] };
            }
            return { results: [] };
          }
        };
      }
    } as unknown as D1Database;
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.speed(context("OWNER", "owner-1"), { DB: db } as Env);
    const body = await response.json() as { value: { timingHistory: { status: string; sampleCount: number; limit: number; operations: Array<{ operation: string; count: number; averageDurationMs: number }> } } };
    expect(response.status).toBe(200);
    expect(body.value.timingHistory.status).toBe("available");
    expect(body.value.timingHistory.sampleCount).toBe(3);
    expect(body.value.timingHistory.limit).toBe(100);
    expect(body.value.timingHistory.operations.find(x => x.operation === "config_generate")?.averageDurationMs).toBe(11);
    expect(JSON.stringify(body)).not.toContain("owner-1");
  });

  it("keeps Speed Lab available when historical telemetry has not been migrated", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async first() { return { ok: 1 }; },
          async all() {
            if (sql.includes("operation_timing_samples")) throw new Error("no such table");
            return { results: [] };
          }
        };
      }
    } as unknown as D1Database;
    const api = new V1SystemsApi({} as ConfigRepository, {} as SubscriptionRepository);
    const response = await api.speed(context("OWNER", "owner-1"), { DB: db } as Env);
    const body = await response.json() as { value: { timingHistory: { status: string; sampleCount: number } } };
    expect(response.status).toBe(200);
    expect(body.value.timingHistory.status).toBe("unavailable");
    expect(body.value.timingHistory.sampleCount).toBe(0);
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
