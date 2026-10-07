import type { Endpoint } from "../models/endpoint";

export interface ConfigPolicy {
  allowedRegions?: string[];
  maxEndpointsPerSubscription: number;
  allowDegradedEndpoints: boolean;
}

export class PolicyEngine {
  isEndpointAllowed(
    endpoint: Endpoint,
    policy: ConfigPolicy
  ): boolean {
    const regionAllowed =
      !policy.allowedRegions ||
      policy.allowedRegions.length === 0 ||
      (endpoint.region !== undefined &&
        policy.allowedRegions.includes(endpoint.region));

    const statusAllowed =
      endpoint.status === "HEALTHY" ||
      (policy.allowDegradedEndpoints && endpoint.status === "DEGRADED");

    return regionAllowed && statusAllowed;
  }
}