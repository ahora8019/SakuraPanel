import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/security/password-credentials";

describe("password credential helpers", () => {
  it("stores only a salted, versioned PBKDF2 credential", async () => {
    const encoded = await hashPassword("correct-horse-battery");
    expect(encoded).toMatch(/^pbkdf2-sha256\$v1\$310000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", encoded)).toBe(true);
  });

  it("uses independent random salts for the same password", async () => {
    const first = await hashPassword("correct-horse-battery");
    const second = await hashPassword("correct-horse-battery");
    expect(first).not.toBe(second);
    expect(await verifyPassword("correct-horse-battery", second)).toBe(true);
  });

  it("rejects a wrong password and malformed credential strings", async () => {
    const encoded = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("incorrect-password", encoded)).toBe(false);
    expect(await verifyPassword("correct-horse-battery", "plain-text-password")).toBe(false);
    expect(await verifyPassword("correct-horse-battery", "pbkdf2-sha256$v1$999999999$abc$abc")).toBe(false);
  });

  it("enforces the password length policy when creating credentials", async () => {
    await expect(hashPassword("short")).rejects.toThrow("password_policy_failed");
    await expect(hashPassword("x".repeat(257))).rejects.toThrow("password_policy_failed");
  });
});
