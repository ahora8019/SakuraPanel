import type { DeviceStatus } from "../models/device";
import { DeviceService } from "../core/device-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class DeviceApi {
  constructor(private readonly service: DeviceService) {}

  async list(context: SecurityContext | null, userId: string): Promise<Response> {
    try { const ctx = requirePermission(context, "user:read"); if (ctx.principal.role === "MEMBER" && ctx.principal.userId !== userId) throw new Error("not_found"); return Response.json({ ok: true, value: await this.service.listForUser(userId) }); }
    catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async create(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "user:write");
      if (!isCreateBody(body)) throw new Error("validation_failed");
      if (ctx.principal.role === "MEMBER" && ctx.principal.userId !== body.userId) throw new Error("not_found");
      const value = await this.service.create({ ...body, now: new Date().toISOString() });
      return Response.json({ ok: true, value }, { status: 201 });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "user:write");
      if (!isStatusBody(body)) throw new Error("validation_failed");
      const current = await this.service.listForUser(ctx.principal.userId).catch(() => []);
      if (ctx.principal.role === "MEMBER" && !current.some(device => device.id === id)) throw new Error("not_found");
      const value = await this.service.updateStatus(id, body.status, new Date().toISOString());
      return Response.json({ ok: true, value });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function isCreateBody(value: unknown): value is { userId: string; name: string; deviceType?: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.userId === "string" && typeof body.name === "string" && (body.deviceType === undefined || typeof body.deviceType === "string");
}
function isStatusBody(value: unknown): value is { status: DeviceStatus } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "DISABLED";
}
function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  return code === "forbidden" ? 403 : code === "not_found" ? 404 : code === "validation_failed" || code === "device_limit_reached" ? 400 : 500;
}
