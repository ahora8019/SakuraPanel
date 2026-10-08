import type { Endpoint } from "../models/endpoint";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEndpoint(endpoint: Endpoint): ValidationResult {
  const errors: string[] = [];

  if (!endpoint.id) errors.push("id_required");
  if (!endpoint.name || endpoint.name.trim().length < 1 || endpoint.name.length > 128) errors.push("invalid_name");
  if (!endpoint.host || endpoint.host.trim().length < 1 || endpoint.host.length > 255) errors.push("invalid_host");
  if (!endpoint.transport || endpoint.transport.length > 32) errors.push("invalid_transport");
  if (!Number.isInteger(endpoint.priority) || endpoint.priority < 0 || endpoint.priority > 1000000) errors.push("invalid_priority");
  if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) {
    errors.push("invalid_port");
  }

  return { valid: errors.length === 0, errors };
}