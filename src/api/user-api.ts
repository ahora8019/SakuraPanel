import type { UserStatus } from "../models/user";
import type { Role } from "../security/roles";
import { UserService } from "../core/user-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class UserApi {
  constructor(private readonly service: UserService) {}

  async list(context: SecurityContext | null): Promise<Response> {
    try { requirePermission(context, "user:read"); return Response.json({ ok: true, value: await this.service.list() }); }
    catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async create(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "user:write");
      if (!isCreateBody(body)) throw new Error("validation_failed");
      const value = await this.service.create({ username: body.username, role: body.role, actorRole: ctx.principal.role, now: new Date().toISOString() });
      return Response.json({ ok: true, value }, { status: 201 });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "user:write");
      if (!isStatusBody(body)) throw new Error("validation_failed");
      const value = await this.service.updateStatus(id, body.status, ctx.principal.role, new Date().toISOString());
      return Response.json({ ok: true, value });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function isCreateBody(value: unknown): value is { username: string; role: Role } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.username === "string" && typeof body.role === "string";
}
function isStatusBody(value: unknown): value is { status: UserStatus } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "SUSPENDED" || status === "DISABLED";
}
function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  return code === "forbidden" ? 403 : code === "not_found" ? 404 : code === "conflict" ? 409 : code === "validation_failed" ? 400 : 500;
}
