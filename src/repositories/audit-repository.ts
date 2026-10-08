import type { AuditAction, AuditEvent, AuditSink } from "../security/audit";

export interface AuditListFilters {
  limit?: number;
  offset?: number;
  actorId?: string;
  resource?: string;
  action?: AuditAction;
}

export interface AuditListResult {
  items: AuditEvent[];
  limit: number;
  offset: number;
}

export class D1AuditRepository implements AuditSink {
  constructor(private readonly db: D1Database) {}

  async write(event: AuditEvent): Promise<void> {
    await this.db.prepare(`INSERT INTO audit_logs
      (id, actor_id, action, resource, resource_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.id,
      event.actorId,
      event.action,
      event.resource,
      event.resourceId ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.createdAt
    ).run();
  }

  async list(filters: AuditListFilters = {}): Promise<AuditListResult> {
    const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 100);
    const offset = Math.min(Math.max(Math.trunc(filters.offset ?? 0), 0), 10_000);

    const clauses: string[] = [];
    const binds: unknown[] = [];

    if (filters.actorId) {
      clauses.push("actor_id = ?");
      binds.push(filters.actorId);
    }
    if (filters.resource) {
      clauses.push("resource = ?");
      binds.push(filters.resource);
    }
    if (filters.action) {
      clauses.push("action = ?");
      binds.push(filters.action);
    }

    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const query = `SELECT id, actor_id, action, resource, resource_id, metadata_json, created_at
      FROM audit_logs${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`;

    const result = await this.db.prepare(query).bind(...binds, limit, offset).all<{
      id: string;
      actor_id: string;
      action: AuditAction;
      resource: string;
      resource_id: string | null;
      metadata_json: string | null;
      created_at: string;
    }>();

    return {
      items: (result.results ?? []).map(row => ({
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        resource: row.resource,
        ...(row.resource_id ? { resourceId: row.resource_id } : {}),
        createdAt: row.created_at,
        ...(row.metadata_json ? { metadata: parseMetadata(row.metadata_json) } : {})
      })),
      limit,
      offset
    };
  }
}

function parseMetadata(value: string): Record<string, string> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string");
    return Object.fromEntries(entries);
  } catch {
    return undefined;
  }
}
