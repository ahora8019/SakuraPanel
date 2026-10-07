import type { Endpoint } from "../models/endpoint";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEndpoint(endpoint: Endpoint): ValidationResult {
  const errors: string[] = [];

  if (!endpoint.id) errors.push("id_required");
  if (!endpoint.name) errors.push("name_required");
  if (!endpoint.host) errors.push("host_required");
  if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) {
    errors.push("invalid_port");
  }

  return { valid: errors.length === 0, errors };
}