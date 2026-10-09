import { describe, expect, it } from "vitest";
import { authorize } from "../src/security/authorization";
import { PERMISSIONS, hasPermission } from "../src/security/permissions";
import type { AuthPrincipal } from "../src/security/auth";
import type { Role } from "../src/security/roles";

const member: AuthPrincipal = {
  userId: "u1", role: "MEMBER", sessionId: "s1", tokenVersion: 1, securityVersion: 1,
  issuedAt: 1000, expiresAt: 2000
};
const admin: AuthPrincipal = { ...member, role: "ADMIN" };
const owner: AuthPrincipal = { ...member, role: "OWNER" };

const expected: Record<Role, readonly string[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [
    "device:read", "device:write", "config:read", "config:write",
    "subscription:read", "subscription:write", "user:read", "audit:read"
  ],
  MEMBER: ["device:read", "device:write", "config:read", "subscription:read"]
};

describe("authorization", () => {
  it("matches the complete permission matrix for every role", () => {
    const roles: Role[] = ["OWNER", "ADMIN", "MEMBER"];
    for (const role of roles) {
      for (const permission of PERMISSIONS) {
        expect(
          hasPermission(role, permission),
          `${role} permission ${permission}`
        ).toBe(expected[role].includes(permission));
      }
    }
  });

  it("denies missing principals for every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(authorize(null, permission)).toBe(false);
    }
  });

  it("allows OWNER to manage security", () => {
    expect(authorize(owner, "security:manage")).toBe(true);
  });

  it("prevents ADMIN and MEMBER from managing security", () => {
    expect(authorize(admin, "security:manage")).toBe(false);
    expect(authorize(member, "security:manage")).toBe(false);
  });

  it("prevents MEMBER from writing configs and subscriptions", () => {
    expect(authorize(member, "config:write")).toBe(false);
    expect(authorize(member, "subscription:write")).toBe(false);
  });

  it("allows ADMIN to write configs but not to grant user-management privileges", () => {
    expect(authorize(admin, "config:write")).toBe(true);
    expect(authorize(admin, "user:write")).toBe(false);
  });
});
