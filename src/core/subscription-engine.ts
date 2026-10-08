import type { GeneratedConfig } from "../models/config";
import type {
  Subscription,
  SubscriptionVersion
} from "../models/subscription";

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

    const eligible = input.configs.filter(
      config =>
        config.status === "ACTIVE" &&
        (!config.expiresAt || Date.parse(config.expiresAt) > nowMs)
    );

    if (eligible.length === 0) {
      throw new Error("no_eligible_configs");
    }

    const previousVersion = 0;
    const nowMs = Date.parse(input.now ?? new Date().toISOString());
    return {
      id: crypto.randomUUID(),
      subscriptionId: input.subscription.id,
      version: previousVersion + 1,
      configIds: eligible.map(config => config.id),
      createdAt: input.now ?? new Date().toISOString()
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
    if (version < 1) {
      throw new Error("invalid_version");
    }

    const nowMs = Date.parse(now);
    const activeIds = configs
      .filter(config => config.status === "ACTIVE" && (!config.expiresAt || Date.parse(config.expiresAt) > nowMs))
      .map(config => config.id);

    return {
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      version,
      configIds: activeIds,
      createdAt: now
    };
  }
}