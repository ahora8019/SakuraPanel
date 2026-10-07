import type { ConfigTemplate } from "../models/template";
import { TemplateService } from "../core/template-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class TemplateApi {
  constructor(private readonly service: TemplateService) {}

  async list(context: SecurityContext | null): Promise<Response> {
    try {
      requirePermission(context, "config:read");
      return Response.json({ ok: true, value: await this.service.list("ACTIVE") });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async create(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      requirePermission(context, "config:write");
      if (!isCreateBody(body)) throw new Error("validation_failed");
      const value = await this.service.create(body);
      return Response.json({ ok: true, value }, { status: 201 });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      requirePermission(context, "config:write");
      if (!isStatusBody(body)) throw new Error("validation_failed");
      return Response.json({ ok: true, value: await this.service.updateStatus(id, body.status) });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function isCreateBody(value: unknown): value is {
  name: string; protocol: string; version?: number; definition: Record<string, unknown>; status?: ConfigTemplate["status"];
} {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return typeof b.name === "string" && typeof b.protocol === "string" &&
    (b.version === undefined || typeof b.version === "number") &&
    !!b.definition && typeof b.definition === "object" && !Array.isArray(b.definition) &&
    (b.status === undefined || b.status === "ACTIVE" || b.status === "DISABLED" || b.status === "RETIRED");
}

function isStatusBody(value: unknown): value is { status: ConfigTemplate["status"] } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "DISABLED" || status === "RETIRED";
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "validation_failed") return 400;
  return 500;
}
