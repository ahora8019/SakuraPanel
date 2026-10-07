import type { SubscriptionVersion } from "../models/subscription";

export function validateSubscriptionVersion(
  version: SubscriptionVersion
): string[] {
  const errors: string[] = [];

  if (!version.id) errors.push("id_required");
  if (!version.subscriptionId) errors.push("subscription_id_required");
  if (version.version < 1) errors.push("invalid_version");
  if (version.configIds.length === 0) errors.push("configs_required");

  return errors;
}