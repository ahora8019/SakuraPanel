import { describe, expect, it } from "vitest";
import { authorize } from "../src/security/authorization";
import type { AuthPrincipal } from "../src/security/auth";

const member: AuthPrincipal = {
  userId: "u1",
  role: "MEMBER",
  sessionId: "s1",
  tokenVersion: 1,
  securityVersion: 1,
  issuedAt: 1000,
  expiresAt: 2000
};

const admin: AuthPrincipal = {
  ...member,
  role: "ADMIN"
};

describe("authorization", () => {
  it("allows members to read endpoints", () => {
    expect(authorize(member, "endpoint:read")).toBe(true);
  });

  it("blocks members from writing endpoints", () => {
    expect(authorize(member, "endpoint:write")).toBe(false);
  });

  it("allows admins to write endpoints", () => {
    expect(authorize(admin, "endpoint:write")).toBe(true);
  });
});
