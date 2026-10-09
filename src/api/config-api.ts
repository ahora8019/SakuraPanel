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
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) throw new Error("not_found");
      return Response.json({ ok: true, value: config });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async list(context: SecurityContext | null, userId?: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const targetUserId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : (userId ?? ctx.principal.userId);
      return Response.json({ ok: true, value: await this.service.listByUserId(targetUserId) });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async generate(context: SecurityContext | null, body: unknown): Promise<Response> {
    const startedAt = performance.now();
    try {
      const ctx = requirePermission(context, "config:write");
      if (!isGenerateBody(body)) throw new Error("validation_failed");
      const userId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : body.userId;
      const value = await this.service.generate({
        identity: { userId, ...(body.deviceId ? { deviceId: body.deviceId } : {}) },
        templateId: body.templateId,
        expiresAt: body.expiresAt,
        now: new Date().toISOString()
      });
      const durationMs = Math.max(0, performance.now() - startedAt).toFixed(2);
      return Response.json({ ok: true, value }, { status: 201, headers: { "Server-Timing": `config_generate;dur=${durationMs}`, "Cache-Control": "no-store" } });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      const config = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) throw new Error("not_found");
      if (!isStatusBody(body)) throw new Error("validation_failed");
      const value = await this.service.updateStatus(id, body.status, new Date().toISOString());
      return Response.json({ ok: true, value });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function isGenerateBody(value: unknown): value is {
  userId: string; templateId: string; deviceId?: string; expiresAt?: string;
} {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return typeof b.userId === "string" &&
    typeof b.templateId === "string" &&
    (b.deviceId === undefined || typeof b.deviceId === "string") &&
    (b.expiresAt === undefined || typeof b.expiresAt === "string");
}

function isStatusBody(value: unknown): value is { status: ConfigStatus } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "EXPIRED" || status === "REVOKED";
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden" || code === "user_not_active") return 403;
  if (code === "not_found" || code === "template_not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "validation_failed" || code.includes("required") || code === "template_not_active" || code === "invalid_expiration" || code === "device_not_owned") return 400;
  return 500;
}
