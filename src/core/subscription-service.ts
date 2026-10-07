import type { GeneratedConfig } from "../models/config";
import type { SubscriptionVersion } from "../models/subscription";
import type { SubscriptionRepository } from "../repositories/subscription-repository";

export class SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}

  async buildVersion(
    subscriptionId: string,
    configs: GeneratedConfig[],
    now = new Date().toISOString()
  ): Promise<SubscriptionVersion> {
    const subscription = await this.repository.findById(subscriptionId);
    if (!subscription) throw new Error("subscription_not_found");
    if (subscription.status !== "ACTIVE") throw new Error("subscription_not_active");

    const eligible = configs.filter(
      config => config.status === "ACTIVE" &&
        (!config.expiresAt || Date.parse(config.expiresAt) > Date.parse(now))
    );
    if (eligible.length === 0) throw new Error("no_eligible_configs");

    const latest = await this.repository.getLatestVersion(subscriptionId);
    const version = (latest?.version ?? 0) + 1;

    const snapshot: SubscriptionVersion = {
      id: crypto.randomUUID(),
      subscriptionId,
      version,
      configIds: eligible.map(config => config.id),
      createdAt: now
    };

    await this.repository.saveVersion(snapshot);
    return snapshot;
  }

  async getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    return this.repository.getLatestVersion(subscriptionId);
  }
}
