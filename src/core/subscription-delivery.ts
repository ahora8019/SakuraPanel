import type { ConfigRepository } from "../repositories/config-repository";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { GeneratedConfig } from "../models/config";
import type { CompatibilityMatrixTarget } from "../models/config-compatibility";
import { evaluateCompatibilityMatrix } from "./config-compatibility";
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

  async getSnapshot(
    token: string,
    now = new Date().toISOString(),
    compatibilityTarget?: CompatibilityMatrixTarget
  ): Promise<PublicSubscriptionSnapshot> {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new Error("not_found");

    const tokenHash = await hashSubscriptionToken(token);
    const subscription = await this.subscriptions.findByPublicTokenHash(tokenHash);
    if (!subscription || subscription.status !== "ACTIVE") throw new Error("not_found");

    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");
    if (subscription.expiresAt) {
      const expiresMs = Date.parse(subscription.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("subscription_expired");
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

    const compatibilityEligible = compatibilityTarget
      ? eligible.filter(config => evaluateCompatibilityMatrix(config, compatibilityTarget, { now }).entries.every(entry => entry.status === "compatible"))
      : eligible;

    if (compatibilityEligible.length === 0) throw new Error("no_eligible_configs");

    const byId = new Map(compatibilityEligible.map(config => [config.id, config]));
    const ordered = version.configIds
      .map(id => byId.get(id))
      .filter((config): config is GeneratedConfig => Boolean(config));

    if (ordered.length === 0) throw new Error("no_eligible_configs");

    return {
      subscriptionId: subscription.id,
      version: version.version,
      ...(subscription.expiresAt ? { expiresAt: subscription.expiresAt } : {}),
      configs: ordered
    };
  }
}
