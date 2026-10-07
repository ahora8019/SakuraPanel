import type { Endpoint } from "../models/endpoint";

export interface SelectionPolicy {
  region?: string;
  maxEndpoints: number;
  allowDegraded?: boolean;
}

export class SelectionEngine {
  select(endpoints: Endpoint[], policy: SelectionPolicy): Endpoint[] {
    return endpoints
      .filter(e => e.status === "HEALTHY" || (policy.allowDegraded !== false && e.status === "DEGRADED"))
      .filter(e => !policy.region || e.region === policy.region)
      .sort((a, b) => Number(b.status === "HEALTHY") - Number(a.status === "HEALTHY") || a.priority - b.priority)
      .slice(0, policy.maxEndpoints);
  }
}