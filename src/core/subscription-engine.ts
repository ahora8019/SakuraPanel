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
        (!config.expiresAt || Date.parse(config.expiresAt) > Date.now())
    );

    if (eligible.length === 0) {
      throw new Error("no_eligible_configs");
    }

    const previousVersion = 0;
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
    if (version < 1) {
      throw new Error("invalid_version");
    }

    const activeIds = configs
      .filter(config => config.status === "ACTIVE")
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