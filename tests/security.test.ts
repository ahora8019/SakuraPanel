import { describe, expect, it } from "vitest";
import { AuthService } from "../src/security/auth";
import { hasPermission } from "../src/security/permissions";
import { AbuseDetector } from "../src/security/abuse-detection";
import { createAuditEvent } from "../src/security/audit";

describe("security core", () => {
  it("issues and verifies signed tokens", async () => {
    const auth = new AuthService("12345678901234567890123456789012");
    const token = await auth.issueToken(
      { userId: "user-1", role: "MEMBER", sessionId: "session-1" },
      3600,
      1000
    );

    const principal = await auth.verifyToken(token, 1200);
    expect(principal?.userId).toBe("user-1");
    expect(principal?.role).toBe("MEMBER");
  });

  it("rejects expired tokens", async () => {
    const auth = new AuthService("12345678901234567890123456789012");
    const token = await auth.issueToken(
      { userId: "user-1", role: "MEMBER", sessionId: "session-1" },
      60,
      1000
    );

    expect(await auth.verifyToken(token, 1060)).toBeNull();
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
});