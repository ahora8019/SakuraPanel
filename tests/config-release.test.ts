import { describe, expect, it } from "vitest";
import { ConfigReleaseService } from "../src/core/config-release-service";
import type { ConfigRelease } from "../src/models/config-release";
import type { GeneratedConfig } from "../src/models/config";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { ConfigReleaseRepository } from "../src/repositories/config-release-repository";

class MemoryConfigRepository implements ConfigRepository {
  constructor(private readonly config: GeneratedConfig) {}
  async findById(id: string) { return id === this.config.id ? this.config : null; }
  async listByUserId(userId: string) { return this.config.userId === userId ? [this.config] : []; }
  async listByIds(ids: string[]) { return ids.includes(this.config.id) ? [this.config] : []; }
  async save() {}
  async updateStatus() { return true; }
  async getLatestVersion() { return 2; }
  async saveVersion() {}
  async getVersionPayload(_configId: string, version: number) {
    return version === 1 || version === 2 ? { version } : null;
  }
}

class MemoryReleaseRepository implements ConfigReleaseRepository {
  releases = new Map<string, ConfigRelease>();
  async find(configId: string, version: number) {
    return this.releases.get(configId + ":" + version) ?? null;
  }
  async list(configId: string) {
    return [...this.releases.values()].filter(r => r.configId === configId).sort((a,b) => b.version - a.version);
  }
  async publish(configId: string, version: number, actorId: string, now: string) {
    for (const release of this.releases.values()) {
      if (release.configId === configId && release.status === "PUBLISHED") {
        release.status = "ROLLED_BACK";
        release.rolledBackAt = now;
      }
    }
    const key = configId + ":" + version;
    const release: ConfigRelease = {
      id: this.releases.get(key)?.id ?? crypto.randomUUID(),
      configId, version, status: "PUBLISHED", actorId, createdAt: this.releases.get(key)?.createdAt ?? now,
      publishedAt: now
    };
    this.releases.set(key, release);
    return release;
  }
}

describe("config release lifecycle", () => {
  it("publishes and rolls back a valid config version", async () => {
    const config: GeneratedConfig = {
      id: "cfg-1", userId: "owner-1", templateId: "tpl-1", templateVersion: 1,
      payload: { version: 1 }, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z"
    };
    const service = new ConfigReleaseService(
      new MemoryConfigRepository(config),
      new MemoryReleaseRepository()
    );

    const published = await service.publish("cfg-1", 2, "owner-1", "2026-01-01T00:01:00.000Z");
    expect(published.status).toBe("PUBLISHED");
    expect(published.version).toBe(2);

    const rolledBack = await service.rollback("cfg-1", 1, "owner-1", "2026-01-01T00:02:00.000Z");
    expect(rolledBack.status).toBe("PUBLISHED");
    expect(rolledBack.version).toBe(1);
  });

  it("rejects a version that does not exist", async () => {
    const config: GeneratedConfig = {
      id: "cfg-1", userId: "owner-1", templateId: "tpl-1", templateVersion: 1,
      payload: {}, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z"
    };
    const service = new ConfigReleaseService(
      new MemoryConfigRepository(config),
      new MemoryReleaseRepository()
    );
    await expect(service.publish("cfg-1", 99, "owner-1")).rejects.toThrow("version_not_found");
  });
});
