import type { ConfigStatus } from "../models/config";
import { ConfigService } from "../core/config-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class ConfigApi {
  constructor(private readonly service: ConfigService) {}

  async get(context: SecurityContext | null, id: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const config = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) {
        throw new Error("not_found");
      }
      return Response.json({ ok: true, value: config });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async list(context: SecurityContext | null, userId?: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const targetUserId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : (userId ?? ctx.principal.userId);
      return Response.json({ ok: true, value: await this.service.listByUserId(targetUserId) });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async generate(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      if (!isGenerateBody(body)) throw new Error("validation_failed");
      const userId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : body.userId;
      const value = await this.service.generate({
        identity: { userId, ...(body.deviceId ? { deviceId: body.deviceId } : {}) },
        endpointId: body.endpointId,
        region: body.region,
        templateId: body.templateId,
        expiresAt: body.expiresAt,
        allowDegraded: body.allowDegraded,
        now: new Date().toISOString()
      });
      return Response.json({ ok: true, value }, { status: 201 });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      const config = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) {
        throw new Error("not_found");
      }
      if (!isStatusBody(body)) throw new Error("validation_failed");
      const value = await this.service.updateStatus(id, body.status, new Date().toISOString());
      return Response.json({ ok: true, value });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function isGenerateBody(value: unknown): value is {
  userId: string; endpointId?: string; region?: string; templateId: string; deviceId?: string; expiresAt?: string; allowDegraded?: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return typeof b.userId === "string" && (b.endpointId === undefined || typeof b.endpointId === "string") &&
    (b.region === undefined || typeof b.region === "string") && typeof b.templateId === "string" &&
    (b.deviceId === undefined || typeof b.deviceId === "string") &&
    (b.expiresAt === undefined || typeof b.expiresAt === "string") &&
    (b.allowDegraded === undefined || typeof b.allowDegraded === "boolean");
}

function isStatusBody(value: unknown): value is { status: ConfigStatus } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "EXPIRED" || status === "REVOKED";
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden" || code === "user_not_active") return 403;
  if (code === "not_found" || code === "endpoint_not_found" || code === "template_not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "validation_failed" || code.includes("required") || code === "endpoint_not_eligible" || code === "no_eligible_endpoint" || code === "template_not_active" || code === "invalid_expiration" || code === "conflicting_endpoint_selection" || code === "device_not_owned") return 400;
  return 500;
}
