import { evaluateCompatibilityMatrix } from "../core/config-compatibility";
import { parseCompatibilityTarget } from "../core/compatibility-target";
import { ConfigService } from "../core/config-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class ConfigCompatibilityApi {
  constructor(private readonly service: ConfigService) {}

  async get(context: SecurityContext | null, id: string, searchParams: URLSearchParams): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const config = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) throw new Error("not_found");

      const target = parseCompatibilityTarget(searchParams);
      return Response.json(
        { ok: true, value: evaluateCompatibilityMatrix(config, target) },
        { headers: { "cache-control": "no-store" } }
      );
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "validation_failed") return 400;
  return 500;
}
