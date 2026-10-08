import { describe, expect, it } from "vitest";
import { AuditApi } from "../src/api/audit-api";
import type { SecurityContext } from "../src/security/security-middleware";

const context: SecurityContext = {
  principal: {
    userId: "owner-1",
    role: "OWNER",
    sessionId: "session-1",
    tokenVersion: 1,
    securityVersion: 1
  }
};

describe("AuditApi", () => {
  it("returns a paginated audit timeline", async () => {
    let received: Record<string, unknown> | undefined;
    const repository = {
      list: async (filters: Record<string, unknown>) => {
        received = filters;
        return {
          items: [{
            id: "audit-1",
            actorId: "owner-1",
            action: "ADMIN_ACTION" as const,
            resource: "config",
            resourceId: "cfg-1",
            createdAt: "2026-10-08T00:00:00.000Z",
            metadata: { result: "published" }
          }],
          limit: 25,
          offset: 5
        };
      }
    };

    const response = await new AuditApi(repository as never).list(
      context,
      new URLSearchParams("limit=25&offset=5&resource=config&action=ADMIN_ACTION")
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; value: { items: unknown[]; limit: number; offset: number } };
    expect(body.ok).toBe(true);
    expect(body.value.limit).toBe(25);
    expect(body.value.offset).toBe(5);
    expect(received).toMatchObject({
      limit: 25,
      offset: 5,
      resource: "config",
      action: "ADMIN_ACTION"
    });
  });

  it("rejects invalid filters", async () => {
    const response = await new AuditApi({ list: async () => ({ items: [], limit: 1, offset: 0 }) } as never)
      .list(context, new URLSearchParams("limit=101"));
    expect(response.status).toBe(400);
  });
});
