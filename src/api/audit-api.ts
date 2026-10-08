import { requirePermission, type SecurityContext } from "../security/security-middleware";
import type { AuditAction } from "../security/audit";
import type { D1AuditRepository } from "../repositories/audit-repository";

const ACTIONS: readonly AuditAction[] = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "REVOKE", "ADMIN_ACTION", "SECURITY_EVENT"
];

export class AuditApi {
  constructor(private readonly audits: D1AuditRepository) {}

  async list(context: SecurityContext | null, params: URLSearchParams): Promise<Response> {
    try {
      requirePermission(context, "audit:read");

      const limitValue = params.get("limit");
      const offsetValue = params.get("offset");
      const limit = limitValue === null ? undefined : Number(limitValue);
      const offset = offsetValue === null ? undefined : Number(offsetValue);

      if ((limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) ||
          (offset !== undefined && (!Number.isInteger(offset) || offset < 0 || offset > 10_000))) {
        throw new Error("validation_failed");
      }

      const actorId = params.get("actorId") ?? undefined;
      const resource = params.get("resource") ?? undefined;
      const actionValue = params.get("action") ?? undefined;
      const action = actionValue as AuditAction | undefined;

      if (action && !ACTIONS.includes(action)) throw new Error("validation_failed");

      const result = await this.audits.list({ limit, offset, actorId, resource, action });
      return Response.json({ ok: true, value: result }, {
        headers: { "cache-control": "no-store" }
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status =
        code === "forbidden" ? 403 :
        code === "validation_failed" ? 400 :
        500;

      return Response.json({
        ok: false,
        error: status === 403 ? "forbidden" : status === 400 ? "validation_failed" : "internal_error"
      }, {
        status,
        headers: { "cache-control": "no-store" }
      });
    }
  }
}
