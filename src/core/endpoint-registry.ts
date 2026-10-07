import type { Endpoint } from "../models/endpoint";
import type { ID, ServiceResult } from "../types/common";

export class EndpointRegistry {
  private readonly endpoints = new Map<ID, Endpoint>();

  register(endpoint: Endpoint): ServiceResult<Endpoint> {
    if (this.endpoints.has(endpoint.id)) {
      return { ok: false, error: "endpoint_already_exists" };
    }
    this.endpoints.set(endpoint.id, endpoint);
    return { ok: true, value: endpoint };
  }

  get(id: ID): ServiceResult<Endpoint> {
    const endpoint = this.endpoints.get(id);
    return endpoint
      ? { ok: true, value: endpoint }
      : { ok: false, error: "endpoint_not_found" };
  }

  list(): Endpoint[] {
    return [...this.endpoints.values()];
  }
}