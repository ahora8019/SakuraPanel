import type { GeneratedConfig } from "../models/config";
import type {
  Subscription,
  SubscriptionVersion
} from "../models/subscription";

const MAX_CONFIGS_PER_SUBSCRIPTION = 100;

export interface SubscriptionBuildInput {
  subscription: Subscription;
  configs: GeneratedConfig[];
  now?: string;
}

export class SubscriptionEngine {
  buildVersion(input: SubscriptionBuildInput): SubscriptionVersion {
    if (input.subscription.status !== "ACTIVE") {
      throw new Error("subscription_not_active");
    }

    const now = input.now ?? new Date().toISOString();
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) throw new Error("invalid_timestamp");
    assertSubscriptionNotExpired(input.subscription, nowMs);

    const eligible = [...new Map(input.configs
      .filter(config =>
        config.userId === input.subscription.userId &&
        config.status === "ACTIVE" &&
        (!config.expiresAt || Date.parse(config.expiresAt) > nowMs)
      )
      .map(config => [config.id, config] as const)).values()];

    if (eligible.length === 0) {
      throw new Error("no_eligible_configs");
    }
    if (eligible.length > MAX_CONFIGS_PER_SUBSCRIPTION) {
      throw new Error("validation_failed");
    }

    return {
      id: crypto.randomUUID(),
      subscriptionId: input.subscription.id,
      version: 1,
      configIds: eligible.map(config => config.id),
      createdAt: now
    };
  }

  buildSnapshot(
    subscription: Subscription,
    configs: GeneratedConfig[],
    version: number,
    now = new Date().toISOString()
  ): SubscriptionVersion {
    if (subscription.status !== "ACTIVE") {
      throw new Error("subscription_not_active");
    }
    if (!Number.isInteger(version) || version < 1) {
      throw new Error("invalid_version");
    }

    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) throw new Error("invalid_timestamp");
    assertSubscriptionNotExpired(subscription, nowMs);

    const activeIds = [...new Set(configs
      .filter(config =>
        config.userId === subscription.userId &&
        config.status === "ACTIVE" &&
        (!config.expiresAt || Date.parse(config.expiresAt) > nowMs)
      )
      .map(config => config.id))];

    if (activeIds.length === 0) throw new Error("no_eligible_configs");
    if (activeIds.length > MAX_CONFIGS_PER_SUBSCRIPTION) throw new Error("validation_failed");

    return {
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      version,
      configIds: activeIds,
      createdAt: now
    };
  }
}

function assertSubscriptionNotExpired(subscription: Subscription, nowMs: number): void {
  if (!subscription.expiresAt) return;
  const expiresMs = Date.parse(subscription.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
    throw new Error("subscription_expired");
  }
}
