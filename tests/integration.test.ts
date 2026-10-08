import { describe, expect, it } from "vitest";
import { EndpointService } from "../src/core/endpoint-service";
import { ConfigService } from "../src/core/config-service";
import { SubscriptionService } from "../src/core/subscription-service";
import type { Endpoint } from "../src/models/endpoint";
import type { ConfigTemplate } from "../src/models/template";
import type { GeneratedConfig, ConfigStatus } from "../src/models/config";
import type { Subscription, SubscriptionVersion } from "../src/models/subscription";
import type { EndpointRepository, HealthState } from "../src/repositories/endpoint-repository";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";
import type { TemplateRepository } from "../src/repositories/template-repository";
import type { UserRepository, UserRecord } from "../src/repositories/user-repository";

class MemoryEndpointRepository implements EndpointRepository {
  endpoints = new Map<string, Endpoint>();
  health = new Map<string, HealthState>();

  async findById(id: string) { return this.endpoints.get(id) ?? null; }
  async list(region?: string) {
    return [...this.endpoints.values()].filter(e => !region || e.region === region);
  }
  async listEligible(region?: string) {
    return (await this.list(region)).filter(e => e.status === "HEALTHY" || e.status === "DEGRADED");
  }
  async save(endpoint: Endpoint) { this.endpoints.set(endpoint.id, endpoint); }
  async updateStatus(id: string, status: Endpoint["status"], updatedAt: string) {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return false;
    this.endpoints.set(id, { ...endpoint, status, updatedAt });
    return true;
  }
  async getHealth(id: string) { return this.health.get(id) ?? null; }
  async saveHealth(state: HealthState) { this.health.set(state.endpointId, state); }
}

class MemoryConfigRepository implements ConfigRepository {
  configs = new Map<string, GeneratedConfig>();
  versions = new Map<string, number>();

  async findById(id: string) { return this.configs.get(id) ?? null; }
  async listByUserId(userId: string) { return [...this.configs.values()].filter(c => c.userId === userId); }
  async save(config: GeneratedConfig) { this.configs.set(config.id, config); this.versions.set(config.id, 1); }
  async updateStatus(id: string, status: ConfigStatus, updatedAt: string) {
    const config = this.configs.get(id);
    if (!config) return false;
    this.configs.set(id, { ...config, status, createdAt: config.createdAt });
    return true;
  }
  async getLatestVersion(configId: string) { return this.versions.get(configId) ?? 0; }
  async saveVersion(configId: string, version: number) { this.versions.set(configId, version); }
}

class MemoryTemplateRepository implements TemplateRepository {
  templates = new Map<string, ConfigTemplate>();
  async findById(id: string) { return this.templates.get(id) ?? null; }
  async list(status?: ConfigTemplate["status"]) {
    return [...this.templates.values()].filter(t => !status || t.status === status);
  }
  async save(template: ConfigTemplate) { this.templates.set(template.id, template); }
  async updateStatus(id: string, status: ConfigTemplate["status"], updatedAt: string) {
    const template = this.templates.get(id);
    if (!template) return false;
    this.templates.set(id, { ...template, status, updatedAt });
    return true;
  }
}

class MemorySubscriptionRepository implements SubscriptionRepository {
  subscriptions = new Map<string, Subscription>();
  versions = new Map<string, SubscriptionVersion[]>();

  async findById(id: string) { return this.subscriptions.get(id) ?? null; }
  async listByUserId(userId: string) {
    return [...this.subscriptions.values()].filter(s => s.userId === userId);
  }
  async create(subscription: Subscription) { this.subscriptions.set(subscription.id, subscription); }
  async updateStatus(id: string, status: Subscription["status"], updatedAt: string) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return false;
    this.subscriptions.set(id, { ...subscription, status, updatedAt });
    return true;
  }
  async getLatestVersion(subscriptionId: string) {
    const versions = this.versions.get(subscriptionId) ?? [];
    return versions.at(-1) ?? null;
  }
  async saveVersion(version: SubscriptionVersion) {
    const versions = this.versions.get(version.subscriptionId) ?? [];
    versions.push(version);
    this.versions.set(version.subscriptionId, versions);
  }
}

class MemoryUserRepository implements UserRepository {
  constructor(private readonly users: UserRecord[]) {}
  async findById(id: string) { return this.users.find(user => user.id === id) ?? null; }
}

function endpoint(id: string, priority: number): Endpoint {
  return {
    id, name: id, host: `${id}.example.test`, port: 443,
    transport: "tcp", tls: true, region: "eu", priority,
    status: "HEALTHY", createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("application integration flow", () => {
  it("provisions a subscription, detects endpoint failure, and rebuilds failover", async () => {
    const endpointRepo = new MemoryEndpointRepository();
    await endpointRepo.save(endpoint("ep-a", 1));
    await endpointRepo.save(endpoint("ep-b", 2));

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

    const endpointService = new EndpointService(endpointRepo);
    const configRepo = new MemoryConfigRepository();
    const configService = new ConfigService(configRepo, endpointService, templateRepo, undefined, undefined, userRepo);
    const subscriptionRepo = new MemorySubscriptionRepository();
    const subscriptionService = new SubscriptionService(
      subscriptionRepo, configRepo, endpointService, configService, undefined, userRepo
    );

    const subscription = await subscriptionService.create("user-1", undefined, "2026-01-01T00:00:00.000Z");
    const v1 = await subscriptionService.provision(subscription.id, {
      templateId: "tpl-1", maxEndpoints: 2
    }, "2026-01-01T00:01:00.000Z");

    expect(v1.version).toBe(1);
    expect(v1.configIds).toHaveLength(2);

    await endpointService.observeHealth({ endpointId: "ep-b", healthy: false, observedAt: "2026-01-01T00:02:00.000Z" });
    await endpointService.observeHealth({ endpointId: "ep-b", healthy: false, observedAt: "2026-01-01T00:03:00.000Z" });
    const failed = await endpointService.observeHealth({ endpointId: "ep-b", healthy: false, observedAt: "2026-01-01T00:04:00.000Z" });

    expect(failed.ok && failed.value.status).toBe("DOWN");

    const v2 = await subscriptionService.rebuildVersion(subscription.id, "2026-01-01T00:05:00.000Z");
    expect(v2.version).toBe(2);
    expect(v2.configIds).toEqual([v1.configIds[0]]);
  });
});
