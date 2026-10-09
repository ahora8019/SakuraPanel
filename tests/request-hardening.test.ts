import { describe, expect, it } from "vitest";
import {
  isCookieMutationSameOrigin,
  limitRequestBody
} from "../src/security/request-hardening";
import { ownerDashboardResponse } from "../src/ui/owner-dashboard";

describe("request security hardening", () => {
  it("blocks cross-origin mutations carrying the browser session cookie", () => {
    expect(isCookieMutationSameOrigin(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: {
        cookie: "sp_session=secret",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site"
      }
    }))).toBe(false);
  });

  it("allows same-origin cookie mutations and bearer-only API requests", () => {
    expect(isCookieMutationSameOrigin(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: { cookie: "sp_session=secret", origin: "https://panel.example", "sec-fetch-site": "same-origin" }
    }))).toBe(true);

    expect(isCookieMutationSameOrigin(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: { authorization: "Bearer api-token" }
    }))).toBe(true);
  });

  it("rejects cookie mutations when Origin is missing and keeps safe methods unaffected", () => {
    expect(isCookieMutationSameOrigin(new Request("https://panel.example/owner/logout", {
      method: "POST",
      headers: { cookie: "sp_session=secret" }
    }))).toBe(false);

    expect(isCookieMutationSameOrigin(new Request("https://panel.example/internal/configs", {
      method: "GET",
      headers: { cookie: "sp_session=secret", origin: "https://attacker.example" }
    }))).toBe(true);
  });

  it("enforces the actual mutation body size and preserves readable bodies", async () => {
    const oversized = new Request("https://panel.example/internal/configs", {
      method: "POST",
      body: "12345"
    });
    expect(await limitRequestBody(oversized, 4)).toBeNull();

    const allowed = await limitRequestBody(new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"ok":true}'
    }), 32);
    expect(allowed).not.toBeNull();
    expect(await allowed!.text()).toBe('{"ok":true}');
  });

  it("rejects oversized declared bodies before reading them", async () => {
    const request = new Request("https://panel.example/internal/configs", {
      method: "POST",
      headers: { "content-length": "1025" },
      body: "small"
    });
    expect(await limitRequestBody(request, 1024)).toBeNull();
  });
  it("serves the owner dashboard with a restrictive browser policy", () => {
    const response = ownerDashboardResponse();
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

});
