import type { Endpoint, EndpointStatus } from "../models/endpoint";

export interface HealthObservation {
  endpointId: string;
  healthy: boolean;
  observedAt: string;
  previousConsecutiveFailures?: number;
  previousConsecutiveSuccesses?: number;
}

const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

export class HealthMonitor {
  observe(endpoint: Endpoint, observation: HealthObservation): EndpointStatus {
    if (endpoint.status === "DISABLED" || endpoint.status === "RETIRED") {
      return endpoint.status;
    }

    if (observation.healthy) {
      const successes = (observation.previousConsecutiveSuccesses ?? 0) + 1;
      if (endpoint.status === "DOWN" || endpoint.status === "DEGRADED") {
        return successes >= RECOVERY_THRESHOLD ? "HEALTHY" : "DEGRADED";
      }
      return "HEALTHY";
    }

    const failures = (observation.previousConsecutiveFailures ?? 0) + 1;
    return failures >= FAILURE_THRESHOLD ? "DOWN" : "DEGRADED";
  }
}
