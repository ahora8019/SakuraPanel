import type { Endpoint, EndpointStatus } from "../models/endpoint";

export interface HealthState {
  endpointId: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt?: string;
  lastHealthyAt?: string;
  lastFailureAt?: string;
}

export interface EndpointRepository {
  findById(id: string): Promise<Endpoint | null>;
  list(region?: string): Promise<Endpoint[]>;
  listEligible(region?: string): Promise<Endpoint[]>;
  save(endpoint: Endpoint): Promise<void>;
  updateStatus(id: string, status: EndpointStatus, updatedAt: string): Promise<boolean>;
  getHealth(id: string): Promise<HealthState | null>;
  saveHealth(state: HealthState): Promise<void>;
}

function mapEndpoint(row: Record<string, unknown>): Endpoint {
  return {
    id: String(row.id),
    name: String(row.name),
    host: String(row.host),
    port: Number(row.port),
    transport: String(row.transport),
    tls: Boolean(row.tls),
    region: row.region == null ? undefined : String(row.region),
    priority: Number(row.priority),
    status: row.status as EndpointStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapHealth(row: Record<string, unknown>): HealthState {
  return {
    endpointId: String(row.endpoint_id),
    consecutiveFailures: Number(row.consecutive_failures),
    consecutiveSuccesses: Number(row.consecutive_successes),
    lastCheckedAt: row.last_checked_at == null ? undefined : String(row.last_checked_at),
    lastHealthyAt: row.last_healthy_at == null ? undefined : String(row.last_healthy_at),
    lastFailureAt: row.last_failure_at == null ? undefined : String(row.last_failure_at)
  };
}

export class D1EndpointRepository implements EndpointRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Endpoint | null> {
    const row = await this.db.prepare(
      "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE id = ?"
    ).bind(id).first<Record<string, unknown>>();
    return row ? mapEndpoint(row) : null;
  }

  async list(region?: string): Promise<Endpoint[]> {
    const query = region
      ? "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE region = ? ORDER BY priority ASC, id ASC"
      : "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints ORDER BY priority ASC, id ASC";
    const result = region
      ? await this.db.prepare(query).bind(region).all<Record<string, unknown>>()
      : await this.db.prepare(query).all<Record<string, unknown>>();
    return result.results.map(mapEndpoint);
  }

  async listEligible(region?: string): Promise<Endpoint[]> {
    const query = region
      ? "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE status IN ('HEALTHY','DEGRADED') AND region = ? ORDER BY priority ASC, id ASC"
      : "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE status IN ('HEALTHY','DEGRADED') ORDER BY priority ASC, id ASC";
    const result = region
      ? await this.db.prepare(query).bind(region).all<Record<string, unknown>>()
      : await this.db.prepare(query).all<Record<string, unknown>>();
    return result.results.map(mapEndpoint);
  }

  async save(endpoint: Endpoint): Promise<void> {
    await this.db.prepare(`INSERT INTO endpoints
      (id,name,host,port,transport,tls,region,priority,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, host=excluded.host, port=excluded.port,
      transport=excluded.transport, tls=excluded.tls, region=excluded.region,
      priority=excluded.priority, status=excluded.status, updated_at=excluded.updated_at`
    ).bind(
      endpoint.id, endpoint.name, endpoint.host, endpoint.port, endpoint.transport,
      endpoint.tls ? 1 : 0, endpoint.region ?? null, endpoint.priority,
      endpoint.status, endpoint.createdAt, endpoint.updatedAt
    ).run();
  }

  async updateStatus(id: string, status: EndpointStatus, updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE endpoints SET status = ?, updated_at = ? WHERE id = ?"
    ).bind(status, updatedAt, id).run();
    return result.meta.changes > 0;
  }

  async getHealth(id: string): Promise<HealthState | null> {
    const row = await this.db.prepare(
      "SELECT endpoint_id, consecutive_failures, consecutive_successes, last_checked_at, last_healthy_at, last_failure_at FROM endpoint_health WHERE endpoint_id = ?"
    ).bind(id).first<Record<string, unknown>>();
    return row ? mapHealth(row) : null;
  }

  async saveHealth(state: HealthState): Promise<void> {
    await this.db.prepare(`INSERT INTO endpoint_health
      (endpoint_id, consecutive_failures, consecutive_successes, last_checked_at, last_healthy_at, last_failure_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint_id) DO UPDATE SET
      consecutive_failures=excluded.consecutive_failures,
      consecutive_successes=excluded.consecutive_successes,
      last_checked_at=excluded.last_checked_at,
      last_healthy_at=excluded.last_healthy_at,
      last_failure_at=excluded.last_failure_at`
    ).bind(
      state.endpointId,
      state.consecutiveFailures,
      state.consecutiveSuccesses,
      state.lastCheckedAt ?? null,
      state.lastHealthyAt ?? null,
      state.lastFailureAt ?? null
    ).run();
  }
}
