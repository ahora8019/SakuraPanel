import type { GeneratedConfig } from "../models/config";
import type { SubscriptionVersion } from "../models/subscription";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import { SubscriptionEngine } from "./subscription-engine";

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly engine = new SubscriptionEngine()
  ) {}

  async buildVersion(
    subscriptionId: string,
    configs: GeneratedConfig[],
    now?: string
  ): Promise<SubscriptionVersion> {
    const subscription = await this.repository.findById(subscriptionId);
    if (!subscription) throw new Error("subscription_not_found");

    const latest = await this.repository.getLatestVersion(subscriptionId);
    const version = this.engine.buildVersion(
      { subscription, configs, now },
      latest?.version ?? 0
    );

    await this.repository.saveVersion(version);
    return version;
  }

  async getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    return this.repository.getLatestVersion(subscriptionId);
  }
}
