import type { SubscriptionDiagnosticsService } from "../core/subscription-diagnostics";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { parseCompatibilityTarget } from "../core/compatibility-target";
import { errorResponse } from "./error-response";

export class SubscriptionDiagnosticsApi {
  constructor(private readonly service: SubscriptionDiagnosticsService) {}

  async get(context: SecurityContext | null, id: string, searchParams?: URLSearchParams): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:read");
      if (ctx.principal.role === "MEMBER" && await this.service.getOwner(id) !== ctx.principal.userId) throw new Error("not_found");
      const target = searchParams && [...searchParams.keys()].length > 0 ? parseCompatibilityTarget(searchParams) : undefined;
      return Response.json(
        { ok: true, value: await this.service.inspect(id, new Date().toISOString(), target) },
        { headers: { "cache-control": "no-store" } }
      );
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "not_found" || code === "subscription_not_found") return 404;
  if (code === "validation_failed") return 400;
  return 500;
}
