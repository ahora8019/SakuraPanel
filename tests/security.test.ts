import { describe, expect, it } from "vitest";
import { AuthService } from "../src/security/auth";
import { hasPermission } from "../src/security/permissions";
import { AbuseDetector } from "../src/security/abuse-detection";
import { createAuditEvent } from "../src/security/audit";
import { SessionService } from "../src/security/session-service";
import type { SessionRecord, SessionRepository } from "../src/repositories/session-repository";
import type { UserRecord } from "../src/repositories/user-repository";

const principalBase = {
  userId: "user-1",
  role: "MEMBER" as const,
  sessionId: "session-1",
  tokenVersion: 1,
  securityVersion: 1
};

describe("security core", () => {
  it("issues and verifies signed tokens", async () => {
    const auth = new AuthService("12345678901234567890123456789012");
    const token = await auth.issueToken(principalBase, 3600, 1000);

    const principal = await auth.verifyToken(token, 1200);
    expect(principal?.userId).toBe("user-1");
    expect(principal?.role).toBe("MEMBER");
    expect(principal?.tokenVersion).toBe(1);
    expect(principal?.securityVersion).toBe(1);
  });

  it("rejects expired tokens", async () => {
    const auth = new AuthService("12345678901234567890123456789012");
    const token = await auth.issueToken(principalBase, 60, 1000);

    expect(await auth.verifyToken(token, 1060)).toBeNull();
  });

  it("rejects malformed bearer values with extra segments", () => {
    const request = new Request("https://example.test", {
      headers: { Authorization: "Bearer abc extra" }
    });

    expect(AuthService.extractBearer(request)).toBeNull();
  });

  it("rejects duplicate or oversized session cookies", () => {
    const duplicate = new Request("https://example.test", {
      headers: { Cookie: "sp_session=one; sp_session=two" }
    });
    expect(AuthService.extractBearer(duplicate)).toBeNull();

    const oversized = new Request("https://example.test", {
      headers: { Cookie: `sp_session=${"a".repeat(4097)}` }
    });
    expect(AuthService.extractBearer(oversized)).toBeNull();
  });

  it("rejects tokens whose requested lifetime exceeds the security bound", async () => {
    const auth = new AuthService("12345678901234567890123456789012");
    await expect(auth.issueToken(principalBase, 86401, 1000)).rejects.toThrow("invalid_token_ttl");
  });

  it("enforces RBAC", () => {
    expect(hasPermission("OWNER", "security:manage")).toBe(true);
    expect(hasPermission("ADMIN", "security:manage")).toBe(false);
    expect(hasPermission("MEMBER", "config:write")).toBe(false);
  });

  it("blocks after accumulated abuse signals", () => {
    const detector = new AbuseDetector(3);
    expect(detector.observe({ key: "ip:1", signal: "AUTH_FAILURE", at: 1000 }).blocked).toBe(false);
    expect(detector.observe({ key: "ip:1", signal: "AUTH_FAILURE", at: 1001 }).blocked).toBe(false);
    expect(detector.observe({ key: "ip:1", signal: "AUTH_FAILURE", at: 1002 }).blocked).toBe(true);
  });

  it("redacts sensitive audit fields", () => {
    const event = createAuditEvent({
      actorId: "user-1",
      action: "SECURITY_EVENT",
      resource: "auth",
      metadata: {
        token: "do-not-log",
        reason: "invalid"
      }
    });

    expect(event.metadata?.token).toBe("[redacted]");
    expect(event.metadata?.reason).toBe("invalid");
  });

  it("rejects revoked sessions and stale security versions", async () => {
    const session: SessionRecord = {
      id: "session-1",
      user_id: "user-1",
      token_version: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      expires_at: "2027-01-01T00:00:00.000Z",
      revoked_at: null,
      last_seen_at: null
    };

    const user: UserRecord = {
      id: "user-1",
      username: "test",
      role: "MEMBER",
      status: "ACTIVE",
      security_version: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    };

    const sessions: SessionRepository = {
      findActiveById: async () => session,
      touch: async () => {},
      revoke: async () => {}
    };

    const users = {
      findById: async () => user
    } as { findById(id: string): Promise<UserRecord | null> };

    const service = new SessionService(sessions, users);
    const principal = {
      ...principalBase,
      issuedAt: 1767225600,
      expiresAt: 1798761600
    };

    expect((await service.validate(principal))?.user.id).toBe("user-1");

    user.security_version = 2;
    expect(await service.validate(principal)).toBeNull();
  });
  it("expires abuse scores after the decay window", () => {
    const detector = new AbuseDetector(3, 100);
    expect(detector.observe({ key: "ip:2", signal: "AUTH_FAILURE", at: 1000 }).score).toBe(1);
    expect(detector.observe({ key: "ip:2", signal: "AUTH_FAILURE", at: 1050 }).score).toBe(2);
    expect(detector.observe({ key: "ip:2", signal: "AUTH_FAILURE", at: 1101 }).score).toBe(1);
  });

  it("blocks exactly at the abuse threshold", () => {
    const detector = new AbuseDetector(2);
    expect(detector.observe({ key: "ip:3", signal: "AUTH_FAILURE", at: 1000 }).blocked).toBe(false);
    expect(detector.observe({ key: "ip:3", signal: "RATE_LIMIT", at: 1001 }).blocked).toBe(true);
  });

  it("supports locking and unlocking through a KV-like store", async () => {
    const values = new Map<string, string>();
    const store = {
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, value: string) => { values.set(key, value); },
      delete: async (key: string) => { values.delete(key); }
    };
    const { EmergencyLock } = await import("../src/security/emergency-lock");
    const lock = new EmergencyLock(store);
    expect(await lock.isLocked()).toBe(false);
    await lock.lock();
    expect(await lock.isLocked()).toBe(true);
    await expect(lock.assertUnlocked()).rejects.toThrow("emergency_lock_active");
    await lock.unlock();
    await expect(lock.assertUnlocked()).resolves.toBeUndefined();
  });

});
