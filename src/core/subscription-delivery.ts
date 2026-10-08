import type { ConfigRepository } from "../repositories/config-repository";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { GeneratedConfig } from "../models/config";
import { hashSubscriptionToken } from "./subscription-token";

const MAX_CONFIGS_PER_SUBSCRIPTION = 100;

export interface PublicSubscriptionSnapshot {
  subscriptionId: string;
  version: number;
  expiresAt?: string;
  configs: GeneratedConfig[];
}

export class SubscriptionDeliveryService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly configs: ConfigRepository
  ) {}

  async getSnapshot(token: string, now = new Date().toISOString()): Promise<PublicSubscriptionSnapshot> {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new Error("not_found");

    const tokenHash = await hashSubscriptionToken(token);
    const subscription = await this.subscriptions.findByPublicTokenHash(tokenHash);
    if (!subscription || subscription.status !== "ACTIVE") throw new Error("not_found");

    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");
    if (subscription.expiresAt && Date.parse(subscription.expiresAt) <= nowMs) {
      throw new Error("subscription_expired");
    }

    const version = await this.subscriptions.getLatestVersion(subscription.id);
    if (!version || version.configIds.length === 0) throw new Error("no_eligible_configs");
    if (version.configIds.length > MAX_CONFIGS_PER_SUBSCRIPTION) throw new Error("validation_failed");

    const configs = await this.configs.listByIds(version.configIds);
    const eligible = configs.filter(config =>
      config.userId === subscription.userId &&
      config.status === "ACTIVE" &&
      (!config.expiresAt || Date.parse(config.expiresAt) > nowMs)
    );

    if (eligible.length === 0) throw new Error("no_eligible_configs");

    const byId = new Map(eligible.map(config => [config.id, config]));
    const ordered = version.configIds
      .map(id => byId.get(id))
      .filter((config): config is GeneratedConfig => Boolean(config));

    return {
      subscriptionId: subscription.id,
      version: version.version,
      ...(subscription.expiresAt ? { expiresAt: subscription.expiresAt } : {}),
      configs: ordered
    };
  }
}
