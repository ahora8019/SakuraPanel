import type { Endpoint } from "../models/endpoint";

export interface EndpointRepository {
  findById(id: string): Promise<Endpoint | null>;
  listEligible(region?: string): Promise<Endpoint[]>;
  save(endpoint: Endpoint): Promise<void>;
}

export class D1EndpointRepository implements EndpointRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Endpoint | null> {
    return this.db.prepare(
      "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE id = ?"
    ).bind(id).first<Endpoint>();
  }

  async listEligible(region?: string): Promise<Endpoint[]> {
    const query = region
      ? "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE status IN ('HEALTHY','DEGRADED') AND region = ? ORDER BY priority ASC"
      : "SELECT id, name, host, port, transport, tls, region, priority, status, created_at, updated_at FROM endpoints WHERE status IN ('HEALTHY','DEGRADED') ORDER BY priority ASC";
    const result = region
      ? await this.db.prepare(query).bind(region).all<Endpoint>()
      : await this.db.prepare(query).all<Endpoint>();
    return result.results;
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
}