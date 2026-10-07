import type { Endpoint, EndpointStatus } from "../models/endpoint";

export interface HealthObservation {
  endpointId: string;
  healthy: boolean;
  observedAt: string;
}

export class HealthMonitor {
  private readonly failures = new Map<string, number>();

  observe(endpoint: Endpoint, observation: HealthObservation): EndpointStatus {
    if (endpoint.status === "DISABLED" || endpoint.status === "RETIRED") {
      return endpoint.status;
    }

    if (observation.healthy) {
      this.failures.set(endpoint.id, 0);
      return "HEALTHY";
    }

    const failures = (this.failures.get(endpoint.id) ?? 0) + 1;
    this.failures.set(endpoint.id, failures);

    return failures >= 3 ? "DOWN" : "DEGRADED";
  }
}