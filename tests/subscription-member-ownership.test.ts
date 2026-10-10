import { describe, expect, it, vi } from "vitest";
import { SubscriptionApi } from "../src/api/subscription-api";
import type { SubscriptionService } from "../src/core/subscription-service";
import type { SecurityContext } from "../src/security/security-middleware";

const member: SecurityContext = { principal: {
  userId: "member-1", role: "MEMBER", sessionId: "session-1",
  tokenVersion: 1, securityVersion: 1, issuedAt: 100, expiresAt: 200
} };

const subscription = (id: string, userId: string) => ({
  id, userId, status: "ACTIVE" as const, publicTokenHash: "hash",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
});

describe("member subscription ownership", () => {
  it("lists only the authenticated member's subscriptions, ignoring userId query", async () => {
    const listByUserId = vi.fn(async (userId: string) => [subscription("s1", userId)]);
    const service = { listByUserId } as unknown as SubscriptionService;
    const api = new SubscriptionApi(service);
    const response = await api.list(member, "member-2");
    expect(response.status).toBe(200);
    expect(listByUserId).toHaveBeenCalledWith("member-1");
    expect(await response.json()).toMatchObject({ value: [{ id: "s1", userId: "member-1" }] });
  });

  it("returns not found for another member's subscription", async () => {
    const service = { get: vi.fn(async () => subscription("s2", "member-2")) } as unknown as SubscriptionService;
    const api = new SubscriptionApi(service);
    const response = await api.get(member, "s2");
    expect(response.status).toBe(404);
  });

  it("does not rotate another member's subscription token", async () => {
    const rotateAccessToken = vi.fn();
    const service = {
      get: vi.fn(async () => subscription("s2", "member-2")),
      rotateAccessToken
    } as unknown as SubscriptionService;
    const api = new SubscriptionApi(service);
    const response = await api.rotateToken(member, "s2");
    expect(response.status).toBe(404);
    expect(rotateAccessToken).not.toHaveBeenCalled();
  });
});
