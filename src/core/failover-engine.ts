import type { Endpoint } from "../models/endpoint";
import type { GeneratedConfig } from "../models/config";

export class FailoverEngine {
  filterAvailable(
    configs: GeneratedConfig[],
    endpoints: Endpoint[]
  ): GeneratedConfig[] {
    const available = new Set(
      endpoints
        .filter(endpoint =>
          endpoint.status === "HEALTHY" || endpoint.status === "DEGRADED"
        )
        .map(endpoint => endpoint.id)
    );

    return configs.filter(
      config => config.status === "ACTIVE" && available.has(config.endpointId)
    );
  }
}