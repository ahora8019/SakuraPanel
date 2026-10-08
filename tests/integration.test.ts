import { describe, expect, it } from "vitest";
import { ConfigService } from "../src/core/config-service";
import { SubscriptionService } from "../src/core/subscription-service";
import type { GeneratedConfig, ConfigStatus } from "../src/models/config";
import type { ConfigTemplate } from "../src/models/template";
import type { Subscription, SubscriptionVersion } from "../src/models/subscription";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";
import type { TemplateRepository } from "../src/repositories/template-repository";
import type { UserRepository, UserRecord } from "../src/repositories/user-repository";

class MemoryConfigRepository implements ConfigRepository {
  configs = new Map<string, GeneratedConfig>();
  versions = new Map<string, number>();
  async findById(id: string) { return this.configs.get(id) ?? null; }
  async listByUserId(userId: string) { return [...this.configs.values()].filter(c => c.userId === userId); }
  async listByIds(ids: string[]) { return ids.map(id => this.configs.get(id)).filter((c): c is GeneratedConfig => Boolean(c)); }
  async save(config: GeneratedConfig) { this.configs.set(config.id, config); this.versions.set(config.id, 1); }
  async updateStatus(id: string, status: ConfigStatus, updatedAt: string) {
    const config = this.configs.get(id); if (!config) return false;
    this.configs.set(id, { ...config, status }); return true;
  }
  async getLatestVersion(configId: string) { return this.versions.get(configId) ?? 0; }
  async saveVersion(configId: string, version: number) { this.versions.set(configId, version); }
}

class MemoryTemplateRepository implements TemplateRepository {
  templates = new Map<string, ConfigTemplate>();
  async findById(id: string) { return this.templates.get(id) ?? null; }
  async list(status?: ConfigTemplate["status"]) { return [...this.templates.values()].filter(t => !status || t.status === status); }
  async save(template: ConfigTemplate) { this.templates.set(template.id, template); }
  async updateStatus(id: string, status: ConfigTemplate["status"], updatedAt: string) {
    const template = this.templates.get(id); if (!template) return false;
    this.templates.set(id, { ...template, status, updatedAt }); return true;
  }
}

class MemorySubscriptionRepository implements SubscriptionRepository {
  subscriptions = new Map<string, Subscription>();
  versions = new Map<string, SubscriptionVersion[]>();
  async findById(id: string) { return this.subscriptions.get(id) ?? null; }
  async findByPublicTokenHash(tokenHash: string) { return [...this.subscriptions.values()].find(s => s.publicTokenHash === tokenHash) ?? null; }
  async listByUserId(userId: string) { return [...this.subscriptions.values()].filter(s => s.userId === userId); }
  async create(subscription: Subscription) { this.subscriptions.set(subscription.id, subscription); }
  async updateStatus(id: string, status: Subscription["status"], updatedAt: string) {
    const subscription = this.subscriptions.get(id); if (!subscription) return false;
    this.subscriptions.set(id, { ...subscription, status, updatedAt }); return true;
  }
  async updatePublicTokenHash(id: string, tokenHash: string, updatedAt: string) {
    const subscription = this.subscriptions.get(id); if (!subscription) return false;
    this.subscriptions.set(id, { ...subscription, publicTokenHash: tokenHash, updatedAt }); return true;
  }
  async getLatestVersion(subscriptionId: string) { return (this.versions.get(subscriptionId) ?? []).at(-1) ?? null; }
  async saveVersion(version: SubscriptionVersion) {
    const versions = this.versions.get(version.subscriptionId) ?? [];
    versions.push(version); this.versions.set(version.subscriptionId, versions);
  }
}

class MemoryUserRepository implements UserRepository {
  constructor(private readonly users: UserRecord[]) {}
  async findById(id: string) { return this.users.find(user => user.id === id) ?? null; }
}

describe("application integration flow", () => {
  it("provisions and rebuilds a subscription without endpoint infrastructure", async () => {
    const userRepo = new MemoryUserRepository([{
      id: "user-1", username: "tester", role: "MEMBER", status: "ACTIVE",
      security_version: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z"
    }]);

    const templateRepo = new MemoryTemplateRepository();
    await templateRepo.save({
      id: "tpl-1", name: "test-template", protocol: "test", version: 1,
      definition: { mode: "integration-test" }, status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    });

    const configRepo = new MemoryConfigRepository();
    const configService = new ConfigService(configRepo, templateRepo, undefined, undefined, userRepo);
    const subscriptionRepo = new MemorySubscriptionRepository();
    const subscriptionService = new SubscriptionService(subscriptionRepo, configRepo, configService, userRepo);

    const created = await subscriptionService.create("user-1", undefined, "2026-01-01T00:00:00.000Z");
    expect(created.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const subscription = created.subscription;
    expect(subscription.publicTokenHash).toBeTruthy();
    const oldToken = created.accessToken;
    const rotated = await subscriptionService.rotateAccessToken(subscription.id, "2026-01-01T00:00:30.000Z");
    expect(rotated.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rotated.accessToken).not.toBe(oldToken);
    expect(rotated.subscription.publicTokenHash).toBeTruthy();

    const v1 = await subscriptionService.provision(subscription.id, {
      templateId: "tpl-1"
    }, "2026-01-01T00:01:00.000Z");

    expect(v1.version).toBe(1);
    expect(v1.configIds).toHaveLength(1);

    const v2 = await subscriptionService.rebuildVersion(subscription.id, "2026-01-01T00:02:00.000Z");
    expect(v2.version).toBe(2);
    expect(v2.configIds).toEqual(v1.configIds);
  });
});
