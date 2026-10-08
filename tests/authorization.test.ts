import { describe, expect, it } from "vitest";
import { authorize } from "../src/security/authorization";
import type { AuthPrincipal } from "../src/security/auth";

const member: AuthPrincipal = {
  userId: "u1", role: "MEMBER", sessionId: "s1", tokenVersion: 1, securityVersion: 1,
  issuedAt: 1000, expiresAt: 2000
};
const admin: AuthPrincipal = { ...member, role: "ADMIN" };

describe("authorization", () => {
  it("allows members to read their configuration", () => {
    expect(authorize(member, "config:read")).toBe(true);
  });

  it("blocks members from writing configuration", () => {
    expect(authorize(member, "config:write")).toBe(false);
  });

  it("allows admins to write configuration", () => {
    expect(authorize(admin, "config:write")).toBe(true);
  });
});
