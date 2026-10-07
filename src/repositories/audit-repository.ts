import type { AuditEvent, AuditSink } from "../security/audit";

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
}