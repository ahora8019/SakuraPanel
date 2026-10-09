import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "../src/core/config-service";
import type { GeneratedConfig } from "../src/models/config";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { TemplateRepository } from "../src/repositories/template-repository";

describe("config revocation lifecycle", () => {
  it("does not reactivate a revoked config", async () => {
    const revoked: GeneratedConfig = {
      id: "cfg-1",
      userId: "user-1",
      templateId: "tpl-1",
      templateVersion: 1,
      payload: {},
      status: "REVOKED",
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    const updateStatus = vi.fn(async () => true);
    const configs = {
      findById: vi.fn(async () => revoked),
      updateStatus
    } as unknown as ConfigRepository;
    const service = new ConfigService(configs, {} as TemplateRepository);

    await expect(service.updateStatus("cfg-1", "ACTIVE", "2026-10-09T00:00:00.000Z"))
      .rejects.toThrow("config_revoked_terminal");
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
