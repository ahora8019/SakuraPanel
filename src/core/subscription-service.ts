import type { Subscription, SubscriptionVersion } from "../models/subscription";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { ConfigRepository } from "../repositories/config-repository";
import { ConfigService } from "./config-service";
import type { UserRepository } from "../repositories/user-repository";
import { generateSubscriptionToken, hashSubscriptionToken } from "./subscription-token";

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly configs: ConfigRepository,
    private readonly configService?: ConfigService,
    private readonly users?: UserRepository
  ) {}

  async create(userId: string, expiresAt?: string, now = new Date().toISOString()): Promise<{ subscription: Subscription; accessToken: string }> {
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

    const accessToken = generateSubscriptionToken();
    const publicTokenHash = await hashSubscriptionToken(accessToken);
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      userId,
      status: "ACTIVE",
      ...(expiresAt ? { expiresAt } : {}),
      publicTokenHash,
      createdAt: now,
      updatedAt: now
    };

    await this.repository.create(subscription);
    return { subscription, accessToken };
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
      deviceId?: string;
      expiresAt?: string;
    },
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
    if (input.expiresAt) {
      const expiresMs = Date.parse(input.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("invalid_expiration");
    }

    if (!this.configService) throw new Error("service_not_configured");

    const config = await this.configService.generate({
      identity: {
        userId: subscription.userId,
        ...(input.deviceId ? { deviceId: input.deviceId } : {})
      },
      templateId: input.templateId,
      expiresAt: input.expiresAt ?? subscription.expiresAt,
      now
    });

    return this.saveNextVersion(subscriptionId, [config.id], now);
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

    const available: string[] = [];
    for (const configId of latest.configIds) {
      const config = await this.configs.findById(configId);
      if (
        config &&
        config.userId === subscription.userId &&
        config.status === "ACTIVE" &&
        (!config.expiresAt || Date.parse(config.expiresAt) > nowMs)
      ) {
        available.push(config.id);
      }
    }

    if (available.length === 0) throw new Error("no_eligible_configs");
    return this.saveNextVersion(subscriptionId, available, now);
  }

  private async saveNextVersion(subscriptionId: string, configIds: string[], now: string): Promise<SubscriptionVersion> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const latest = await this.repository.getLatestVersion(subscriptionId);
      const version: SubscriptionVersion = {
        id: crypto.randomUUID(),
        subscriptionId,
        version: (latest?.version ?? 0) + 1,
        configIds,
        createdAt: now
      };

      try {
        await this.repository.saveVersion(version);
        return version;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 4) throw error;
      }
    }

    throw new Error("version_conflict");
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

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("unique constraint") || message.includes("constraint failed") || message.includes("unique");
}
