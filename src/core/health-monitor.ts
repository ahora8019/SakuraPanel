import type { Endpoint, EndpointStatus } from "../models/endpoint";

export interface HealthObservation {
  endpointId: string;
  healthy: boolean;
  observedAt: string;
  previousConsecutiveFailures?: number;
}

export class HealthMonitor {
  observe(endpoint: Endpoint, observation: HealthObservation): EndpointStatus {
    if (endpoint.status === "DISABLED" || endpoint.status === "RETIRED") {
      return endpoint.status;
    }

    if (observation.healthy) return "HEALTHY";

    const failures = (observation.previousConsecutiveFailures ?? 0) + 1;
    return failures >= 3 ? "DOWN" : "DEGRADED";
  }
}
