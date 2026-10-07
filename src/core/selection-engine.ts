import type { Endpoint } from "../models/endpoint";

export interface SelectionPolicy {
  region?: string;
  maxEndpoints: number;
}

export class SelectionEngine {
  select(endpoints: Endpoint[], policy: SelectionPolicy): Endpoint[] {
    return endpoints
      .filter(e => e.status === "HEALTHY" || e.status === "DEGRADED")
      .filter(e => !policy.region || e.region === policy.region)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, policy.maxEndpoints);
  }
}