import type { SubscriptionVersion } from "../models/subscription";

const MAX_CONFIGS_PER_SUBSCRIPTION = 100;

export function validateSubscriptionVersion(
  version: SubscriptionVersion
): string[] {
  const errors: string[] = [];

  if (!version.id) errors.push("id_required");
  if (!version.subscriptionId) errors.push("subscription_id_required");
  if (!Number.isInteger(version.version) || version.version < 1) errors.push("invalid_version");
  if (!Array.isArray(version.configIds) || version.configIds.length === 0) {
    errors.push("configs_required");
  } else {
    if (version.configIds.length > MAX_CONFIGS_PER_SUBSCRIPTION) errors.push("config_limit_exceeded");
    if (new Set(version.configIds).size !== version.configIds.length) errors.push("duplicate_config_ids");
    if (version.configIds.some(id => typeof id !== "string" || id.length === 0)) errors.push("invalid_config_id");
  }

  if (!Number.isFinite(Date.parse(version.createdAt))) errors.push("invalid_created_at");
  return errors;
}
