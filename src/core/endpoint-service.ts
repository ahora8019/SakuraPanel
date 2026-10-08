import type { Endpoint } from "../models/endpoint";
import type { ServiceResult } from "../types/common";
import type { EndpointRepository } from "../repositories/endpoint-repository";
import { validateEndpoint } from "./validation-engine";
import { HealthMonitor, type HealthObservation } from "./health-monitor";
import { SelectionEngine, type SelectionPolicy } from "./selection-engine";

export class EndpointService {
  constructor(
    private readonly repository: EndpointRepository,
    private readonly healthMonitor = new HealthMonitor(),
    private readonly selectionEngine = new SelectionEngine()
  ) {}

  // SakuraPanel itself does not require an external server. Endpoints are
  // optional infrastructure registered later when real VPS instances exist.
  async create(endpoint: Endpoint): Promise<ServiceResult<Endpoint>> {
    const validation = validateEndpoint(endpoint);
    if (!validation.valid) return { ok: false, error: validation.errors.join(",") };

    if (await this.repository.findById(endpoint.id)) {
      return { ok: false, error: "endpoint_already_exists" };
    }

    // A newly registered endpoint is not trusted for config generation until
    // a health observation promotes it to an eligible state.
    const stored: Endpoint = { ...endpoint, status: "PROVISIONING" };
    await this.repository.save(stored);
    return { ok: true, value: stored };
  }

  async get(id: string): Promise<ServiceResult<Endpoint>> {
    const endpoint = await this.repository.findById(id);
    return endpoint
      ? { ok: true, value: endpoint }
      : { ok: false, error: "endpoint_not_found" };
  }

  async list(region?: string): Promise<Endpoint[]> {
    return this.repository.list(region);
  }

  async select(policy: SelectionPolicy): Promise<Endpoint[]> {
    const endpoints = await this.repository.listEligible(policy.region);
    return this.selectionEngine.select(endpoints, policy);
  }

  async observeHealth(observation: HealthObservation): Promise<ServiceResult<Endpoint>> {
    const endpoint = await this.repository.findById(observation.endpointId);
    if (!endpoint) return { ok: false, error: "endpoint_not_found" };

    const previous = await this.repository.getHealth(endpoint.id);
    const nextStatus = this.healthMonitor.observe(endpoint, { ...observation, previousConsecutiveFailures: previous?.consecutiveFailures ?? 0, previousConsecutiveSuccesses: previous?.consecutiveSuccesses ?? 0 });
    const now = observation.observedAt;
    const state = observation.healthy
      ? {
          endpointId: endpoint.id,
          consecutiveFailures: 0,
          consecutiveSuccesses: (previous?.consecutiveSuccesses ?? 0) + 1,
          lastCheckedAt: now,
          lastHealthyAt: now,
          lastFailureAt: previous?.lastFailureAt
        }
      : {
          endpointId: endpoint.id,
          consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
          consecutiveSuccesses: 0,
          lastCheckedAt: now,
          lastHealthyAt: previous?.lastHealthyAt,
          lastFailureAt: now
        };

    await this.repository.saveHealth(state);
    if (nextStatus !== endpoint.status) {
      await this.repository.updateStatus(endpoint.id, nextStatus, now);
    }

    return {
      ok: true,
      value: { ...endpoint, status: nextStatus, updatedAt: now }
    };
  }
}
