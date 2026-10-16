import { describe, expect, it } from "vitest";
import { userDashboardResponse } from "../src/ui/user-dashboard";

describe("user dashboard preview", () => {
  it("serves a no-store, non-indexable HTML preview with baseline security headers", async () => {
    const response = userDashboardResponse();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("clearly identifies itself as a sample preview and offers all four languages", async () => {
    const html = await (await userDashboardResponse()).text();
    expect(html).toContain("Design preview");
    expect(html).toContain('value="en"');
    expect(html).toContain('value="fa"');
    expect(html).toContain('value="ja"');
    expect(html).toContain('value="ru"');
    expect(html).toContain("Sample data");
  });

  it("does not pretend the sample subscription link is real or call clipboard APIs", async () => {
    const html = await (await userDashboardResponse()).text();
    expect(html).toContain("Preview: no real link to copy");
    expect(html).not.toContain("navigator.clipboard");
    expect(html).not.toContain("clipboard.writeText");
    expect(html).not.toContain("fetch(");
  });

  it("keeps guide/help actions inside the page instead of using alert dialogs", async () => {
    const html = await (await userDashboardResponse()).text();
    expect(html).toContain('id="guide"');
    expect(html).toContain('id="help"');
    expect(html).toContain("guidePanel");
    expect(html).not.toContain("alert(");
  });
});
