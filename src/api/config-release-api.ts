import type { ConfigReleaseService } from "../core/config-release-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class ConfigReleaseApi {
  constructor(private readonly service: ConfigReleaseService) {}

  async list(context: SecurityContext | null, configId: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      await this.assertOwnership(ctx, configId);
      return Response.json({ ok: true, value: await this.service.list(configId) }, {
        headers: { "cache-control": "no-store" }
      });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async publish(context: SecurityContext | null, configId: string, version: number): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      await this.assertOwnership(ctx, configId);
      const value = await this.service.publish(configId, version, ctx.principal.userId);
      return Response.json({ ok: true, value }, { status: 200, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async rollback(context: SecurityContext | null, configId: string, version: number): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      await this.assertOwnership(ctx, configId);
      const value = await this.service.rollback(configId, version, ctx.principal.userId);
      return Response.json({ ok: true, value }, { status: 200, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  private async assertOwnership(context: SecurityContext, configId: string): Promise<void> {
    if (context.principal.role !== "MEMBER") return;
    const ownerId = await this.service.getConfigOwner(configId);
    if (ownerId !== context.principal.userId) throw new Error("not_found");
  }
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden" || code === "user_not_active") return 403;
  if (code === "not_found" || code === "version_not_found" || code === "release_not_found") return 404;
  if (code === "validation_failed") return 400;
  return 500;
}
