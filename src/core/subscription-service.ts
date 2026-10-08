import type { GeneratedConfig } from "../models/config";
import type { Endpoint } from "../models/endpoint";
import type { Subscription, SubscriptionVersion } from "../models/subscription";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { ConfigRepository } from "../repositories/config-repository";
import { EndpointService } from "./endpoint-service";
import { FailoverEngine } from "./failover-engine";
import { ConfigService } from "./config-service";
import type { UserRepository } from "../repositories/user-repository";

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly configs: ConfigRepository,
    private readonly endpoints: EndpointService,
    private readonly configService?: ConfigService,
    private readonly failover = new FailoverEngine(),
    private readonly users?: UserRepository
  ) {}

  async create(userId: string, expiresAt?: string, now = new Date().toISOString()): Promise<Subscription> {
    if (!userId) throw new Error("validation_failed");
    if (this.users) {
      const user = await this.users.findById(userId);
      if (!user || user.status !== "ACTIVE") throw new Error("user_not_active");
    }
    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");
    if (expiresAt) {
      const expiresMs = Date.parse(expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("invalid_expiration");
    }

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

  async provision(
    subscriptionId: string,
    input: {
      templateId: string;
      region?: string;
      maxEndpoints: number;
      deviceId?: string;
      expiresAt?: string;
      allowDegraded?: boolean;
    },
    now = new Date().toISOString()
  ): Promise<SubscriptionVersion> {
    if (!Number.isInteger(input.maxEndpoints) || input.maxEndpoints < 1 || input.maxEndpoints > 20) {
      throw new Error("validation_failed");
    }

    const subscription = await this.get(subscriptionId);
    if (subscription.status !== "ACTIVE") throw new Error("subscription_not_active");
    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");
    if (subscription.expiresAt) {
      const expiresMs = Date.parse(subscription.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("subscription_expired");
    }
    if (input.expiresAt) {
      const expiresMs = Date.parse(input.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("invalid_expiration");
    }

    const endpoints = await this.endpoints.select({
      region: input.region,
      maxEndpoints: input.maxEndpoints,
      allowDegraded: input.allowDegraded === true
    });
    if (endpoints.length === 0) throw new Error("no_eligible_endpoint");

    if (!this.configService) throw new Error("service_not_configured");

    const configs = await this.configService.generateForEndpoints({
      identity: {
        userId: subscription.userId,
        ...(input.deviceId ? { deviceId: input.deviceId } : {})
      },
      endpoints: endpoints.map(endpoint => endpoint.id),
      templateId: input.templateId,
      allowDegraded: input.allowDegraded === true,
      expiresAt: input.expiresAt ?? subscription.expiresAt,
      now
    });

    const latest = await this.repository.getLatestVersion(subscriptionId);
    const version: SubscriptionVersion = {
      id: crypto.randomUUID(),
      subscriptionId,
      version: (latest?.version ?? 0) + 1,
      configIds: configs.map(config => config.id),
      createdAt: now
    };

    await this.repository.saveVersion(version);
    return version;
  }

  async rebuildVersion(
    subscriptionId: string,
    now = new Date().toISOString()
  ): Promise<SubscriptionVersion> {
    const subscription = await this.get(subscriptionId);
    if (subscription.status !== "ACTIVE") throw new Error("subscription_not_active");
    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");
    if (subscription.expiresAt) {
      const expiresMs = Date.parse(subscription.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("subscription_expired");
    }

    const latest = await this.repository.getLatestVersion(subscriptionId);
    if (!latest || latest.configIds.length === 0) throw new Error("no_eligible_configs");

    const configs: GeneratedConfig[] = [];
    for (const configId of latest.configIds) {
      const config = await this.configs.findById(configId);
      if (config && config.userId === subscription.userId) configs.push(config);
    }

    const endpointIds = [...new Set(configs.map(config => config.endpointId))];
    const endpoints: Endpoint[] = [];
    for (const endpointId of endpointIds) {
      const result = await this.endpoints.get(endpointId);
      if (result.ok) endpoints.push(result.value);
    }

    const available = this.failover.filterAvailable(configs, endpoints).filter(config => {
      if (!config.expiresAt) return true;
      const expiresMs = Date.parse(config.expiresAt);
      return !Number.isNaN(expiresMs) && expiresMs > nowMs;
    });
    if (available.length === 0) throw new Error("no_eligible_configs");

    const version: SubscriptionVersion = {
      id: crypto.randomUUID(),
      subscriptionId,
      version: latest.version + 1,
      configIds: available.map(config => config.id),
      createdAt: now
    };

    await this.repository.saveVersion(version);
    return version;
  }

  async getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    return this.repository.getLatestVersion(subscriptionId);
  }

  async updateStatus(
    id: string,
    status: Subscription["status"],
    now = new Date().toISOString()
  ): Promise<Subscription> {
    if (!["ACTIVE", "EXPIRED", "REVOKED"].includes(status)) throw new Error("validation_failed");
    if (!(await this.repository.updateStatus(id, status, now))) throw new Error("subscription_not_found");
    return this.get(id);
  }
}
