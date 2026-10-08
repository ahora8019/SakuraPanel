import type { GeneratedConfig } from "../models/config";
import { validateCompatibilityMetadata } from "./config-compatibility";

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGeneratedConfig(config: GeneratedConfig): ConfigValidationResult {
  const errors: string[] = [];

  if (!config.id) errors.push("id_required");
  if (!config.userId) errors.push("user_id_required");
  if (!config.templateId) errors.push("template_id_required");
  if (config.templateVersion < 1) errors.push("invalid_template_version");
  if (!config.payload || typeof config.payload !== "object") errors.push("payload_required");

  if (config.expiresAt && Number.isNaN(Date.parse(config.expiresAt))) {
    errors.push("invalid_expiration");
  }

  if (config.payload && typeof config.payload === "object") {
    errors.push(...validateCompatibilityMetadata(config.payload.compatibility));
  }

  return { valid: errors.length === 0, errors };
}
