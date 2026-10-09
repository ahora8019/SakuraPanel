import type { SubscriptionRepository } from "../repositories/subscription-repository";
import type { ConfigRepository } from "../repositories/config-repository";
import { evaluateCompatibilityMatrix } from "./config-compatibility";
import type { CompatibilityMatrixTarget } from "../models/config-compatibility";

export interface SubscriptionDiagnostic {
  subscriptionId: string;
  status: "healthy" | "warning" | "error";
  subscription: { status: string; expired: boolean; expiresAt?: string };
  latestVersion: { version: number; configCount: number } | null;
  configs: { referenced: number; eligible: number; missing: number; inactive: number; expired: number; wrongOwner: number };
  compatibility?: {
    checked: number;
    compatible: number;
    partial: number;
    incompatible: number;
    unknown: number;
  };
  issues: string[];
}

export class SubscriptionDiagnosticsService {
  constructor(private readonly subscriptions: SubscriptionRepository, private readonly configs: ConfigRepository) {}

  async getOwner(subscriptionId: string): Promise<string> {
    const subscription = await this.subscriptions.findById(subscriptionId);
    if (!subscription) throw new Error("subscription_not_found");
    return subscription.userId;
  }

  async inspect(
    subscriptionId: string,
    now = new Date().toISOString(),
    compatibilityTarget?: CompatibilityMatrixTarget
  ): Promise<SubscriptionDiagnostic> {
    const subscription = await this.subscriptions.findById(subscriptionId);
    if (!subscription) throw new Error("subscription_not_found");
    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");

    const subscriptionExpiry = subscription.expiresAt ? Date.parse(subscription.expiresAt) : null;
    // Delivery rejects malformed expiry timestamps; diagnostics must report the
    // same result instead of incorrectly marking them as healthy.
    const expired = subscriptionExpiry !== null &&
      (!Number.isFinite(subscriptionExpiry) || subscriptionExpiry <= nowMs);
    const version = await this.subscriptions.getLatestVersion(subscriptionId);
    const issues: string[] = [];
    const base = { status: subscription.status, expired, ...(subscription.expiresAt ? { expiresAt: subscription.expiresAt } : {}) };

    if (subscription.status !== "ACTIVE") issues.push("subscription_not_active");
    if (expired) issues.push("subscription_expired");
    if (!version || version.configIds.length === 0) {
      issues.push("no_eligible_configs");
      return {
        subscriptionId,
        status: "error",
        subscription: base,
        latestVersion: version ? { version: version.version, configCount: version.configIds.length } : null,
        configs: { referenced: 0, eligible: 0, missing: 0, inactive: 0, expired: 0, wrongOwner: 0 },
        ...(compatibilityTarget ? { compatibility: { checked: 0, compatible: 0, partial: 0, incompatible: 0, unknown: 0 } } : {}),
        issues
      };
    }

    if (version.configIds.length > 100) issues.push("config_limit_exceeded");
    const rows = await this.configs.listByIds(version.configIds);
    const byId = new Map(rows.map(c => [c.id, c]));
    let eligible = 0, missing = 0, inactive = 0, configExpired = 0, wrongOwner = 0;
    let compatible = 0, partial = 0, incompatible = 0, unknown = 0;

    for (const id of version.configIds) {
      const config = byId.get(id);
      if (!config) { missing++; continue; }
      if (config.userId !== subscription.userId) { wrongOwner++; continue; }
      if (config.status !== "ACTIVE") { inactive++; continue; }
      if (config.expiresAt) {
        const configExpiry = Date.parse(config.expiresAt);
        if (!Number.isFinite(configExpiry) || configExpiry <= nowMs) {
          configExpired++;
          continue;
        }
      }
      eligible++;

      if (compatibilityTarget) {
        const matrix = evaluateCompatibilityMatrix(config, compatibilityTarget, { now });
        const statuses = matrix.entries.map(entry => entry.status);
        if (statuses.includes("incompatible")) incompatible++;
        else if (statuses.includes("unknown")) unknown++;
        else if (statuses.includes("partial")) partial++;
        else compatible++;
      }
    }

    if (missing) issues.push("missing_configs");
    if (inactive) issues.push("inactive_configs");
    if (configExpired) issues.push("expired_configs");
    if (wrongOwner) issues.push("ownership_mismatch");

    if (compatibilityTarget) {
      if (incompatible) issues.push("incompatible_configs");
      if (unknown) issues.push("unknown_compatibility");
      if (partial) issues.push("partially_compatible_configs");
    }

    const fatal = ["subscription_not_active", "subscription_expired", "no_eligible_configs", "ownership_mismatch", "incompatible_configs", "unknown_compatibility"];
    const status = issues.some(x => fatal.includes(x)) ? "error" : issues.length ? "warning" : "healthy";
    return {
      subscriptionId,
      status,
      subscription: base,
      latestVersion: { version: version.version, configCount: version.configIds.length },
      configs: { referenced: version.configIds.length, eligible, missing, inactive, expired: configExpired, wrongOwner },
      ...(compatibilityTarget ? { compatibility: { checked: compatible + partial + incompatible + unknown, compatible, partial, incompatible, unknown } } : {}),
      issues
    };
  }
}
