import { describe, expect, it } from "vitest";
import { AuthService } from "../src/security/auth";

describe("session cookie extraction", () => {
  it("accepts a single encoded session cookie", () => {
    const request = new Request("https://example.test/user", {
      headers: { Cookie: "theme=dark; sp_session=abc.def.ghi" }
    });
    expect(AuthService.extractBearer(request)).toBe("abc.def.ghi");
  });

  it("rejects duplicate session cookies instead of choosing one", () => {
    const request = new Request("https://example.test/user", {
      headers: { Cookie: "sp_session=first; sp_session=second" }
    });
    expect(AuthService.extractBearer(request)).toBeNull();
  });

  it("rejects malformed percent encoding", () => {
    const request = new Request("https://example.test/user", {
      headers: { Cookie: "sp_session=%E0%A4%A" }
    });
    expect(AuthService.extractBearer(request)).toBeNull();
  });

  it("prefers a valid Bearer header when both mechanisms are present", () => {
    const request = new Request("https://example.test/internal/me", {
      headers: {
        Authorization: "Bearer header-token",
        Cookie: "sp_session=cookie-token"
      }
    });
    expect(AuthService.extractBearer(request)).toBe("header-token");
  });

  it("rejects an oversized session cookie", () => {
    const request = new Request("https://example.test/user", {
      headers: { Cookie: `sp_session=${"a".repeat(4097)}` }
    });
    expect(AuthService.extractBearer(request)).toBeNull();
  });
});
