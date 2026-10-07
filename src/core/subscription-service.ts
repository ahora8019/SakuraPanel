import type { GeneratedConfig } from "../models/config";
import type { Subscription, SubscriptionVersion } from "../models/subscription";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { ConfigRepository } from "../repositories/config-repository";
import { EndpointService } from "./endpoint-service";
import { FailoverEngine } from "./failover-engine";

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly configs: ConfigRepository,
    private readonly endpoints: EndpointService,
    private readonly failover = new FailoverEngine()
  ) {}

  async create(userId: string, expiresAt?: string, now = new Date().toISOString()): Promise<Subscription> {
    if (!userId) throw new Error("validation_failed");
    if (expiresAt && Date.parse(expiresAt) <= Date.parse(now)) throw new Error("invalid_expiration");
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      userId,
      status: "ACTIVE",
      ...(expiresAt ? { expiresAt } : {}),
      createdAt: now,
      updatedAt: now
    };
    await this.repository.create(subscription);
    return subscription;
  }

  async get(id: string): Promise<Subscription> {
    const subscription = await this.repository.findById(id);
    if (!subscription) throw new Error("subscription_not_found");
    return subscription;
  }

  async listByUserId(userId: string): Promise<Subscription[]> {
    return this.repository.listByUserId(userId);
  }

  async rebuildVersion(
    subscriptionId: string,
    now = new Date().toISOString()
  ): Promise<SubscriptionVersion> {
    const subscription = await this.get(subscriptionId);
    if (subscription.status !== "ACTIVE") throw new Error("subscription_not_active");
    if (subscription.expiresAt && Date.parse(subscription.expiresAt) <= Date.parse(now)) {
      throw new Error("subscription_expired");
    }

    const configs = await this.configs.listByUserId(subscription.userId);
    const endpointIds = [...new Set(configs.map(config => config.endpointId))];
    const endpoints = [];
    for (const endpointId of endpointIds) {
      const result = await this.endpoints.get(endpointId);
      if (result.ok) endpoints.push(result.value);
    }

    const available = this.failover.filterAvailable(configs, endpoints).filter(
      config => !config.expiresAt || Date.parse(config.expiresAt) > Date.parse(now)
    );
    if (available.length === 0) throw new Error("no_eligible_configs");

    const latest = await this.repository.getLatestVersion(subscriptionId);
    const version: SubscriptionVersion = {
      id: crypto.randomUUID(),
      subscriptionId,
      version: (latest?.version ?? 0) + 1,
      configIds: available.map(config => config.id),
      createdAt: now
    };

    await this.repository.saveVersion(version);
    return version;
  }

  async getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    return this.repository.getLatestVersion(subscriptionId);
  }

  async updateStatus(id: string, status: Subscription["status"], now = new Date().toISOString()): Promise<Subscription> {
    if (!["ACTIVE", "EXPIRED", "REVOKED"].includes(status)) throw new Error("validation_failed");
    if (!(await this.repository.updateStatus(id, status, now))) throw new Error("subscription_not_found");
    return this.get(id);
  }
}
