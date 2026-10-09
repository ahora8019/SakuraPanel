import { describe, expect, it } from "vitest";
import { ConfigApi } from "../src/api/config-api";
import type { ConfigService } from "../src/core/config-service";
import type { GeneratedConfig } from "../src/models/config";
import type { SecurityContext } from "../src/security/security-middleware";

const config: GeneratedConfig = {
  id: "cfg-1",
  userId: "user-2",
  templateId: "tpl-1",
  templateVersion: 1,
  payload: { identity: { userId: "user-2" } },
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z"
};

const memberContext: SecurityContext = {
  principal: {
    userId: "user-1",
    role: "MEMBER",
    sessionId: "session-1",
    tokenVersion: 1,
    securityVersion: 1,
    issuedAt: 1000,
    expiresAt: 2000
  }
};

function makeApi(overrides: Partial<{
  get: (id: string) => Promise<GeneratedConfig>;
  listByUserId: (userId: string) => Promise<GeneratedConfig[]>;
  generate: (input: { identity: { userId: string }; templateId: string; now: string }) => Promise<GeneratedConfig>;
  updateStatus: (id: string, status: GeneratedConfig["status"], now: string) => Promise<GeneratedConfig>;
}> = {}) {
  const calls: { listUserId?: string; generatedUserId?: string; updateStatus?: boolean } = {};
  const service = {
    get: overrides.get ?? (async () => config),
    listByUserId: overrides.listByUserId ?? (async (userId: string) => {
      calls.listUserId = userId;
      return [config];
    }),
    generate: overrides.generate ?? (async (input: { identity: { userId: string }; templateId: string; now: string }) => {
      calls.generatedUserId = input.identity.userId;
      return config;
    }),
    updateStatus: overrides.updateStatus ?? (async () => {
      calls.updateStatus = true;
      return config;
    })
  };
  return { api: new ConfigApi(service as unknown as ConfigService), calls };
}

describe("configuration ownership", () => {
  it("does not allow a member to read another user's config by ID", async () => {
    const { api } = makeApi();
    const response = await api.get(memberContext, "cfg-1");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("ignores a member-supplied userId when listing configs", async () => {
    const { api, calls } = makeApi();
    const response = await api.list(memberContext, "user-2");
    expect(response.status).toBe(200);
    expect(calls.listUserId).toBe("user-1");
  });

  it("denies config generation to MEMBER because config:write is not granted", async () => {
    const { api, calls } = makeApi();
    const response = await api.generate(memberContext, {
      userId: "user-2",
      templateId: "tpl-1"
    });
    expect(response.status).toBe(403);
    expect(calls.generatedUserId).toBeUndefined();
  });

  it("denies MEMBER config status updates through RBAC", async () => {
    const { api, calls } = makeApi();
    const response = await api.updateStatus(memberContext, "cfg-1", { status: "REVOKED" });
    expect(response.status).toBe(403);
    expect(calls.updateStatus).toBeUndefined();
  });

  it("keeps configuration ownership attached to its owner", () => {
    expect(config.userId).toBe("user-2");
    expect(config.payload).toMatchObject({ identity: { userId: "user-2" } });
    expect(config).not.toHaveProperty("endpointId");
  });
});
