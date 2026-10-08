import type { Endpoint } from "../models/endpoint";
import { EndpointService } from "../core/endpoint-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

export class EndpointApi {
  constructor(private readonly service: EndpointService) {}

  async create(context: SecurityContext | null, endpoint: Endpoint): Promise<Response> {
    try {
      requirePermission(context, "endpoint:write");
      const result = await this.service.create(endpoint);
      if (!result.ok) {
        const status = result.error === "endpoint_already_exists" ? 409 : 400;
        return Response.json({ ok: false, error: result.error }, { status, headers: { "cache-control": "no-store" } });
      }
      return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async list(context: SecurityContext | null, region?: string): Promise<Response> {
    try {
      requirePermission(context, "endpoint:read");
      return Response.json({ ok: true, value: await this.service.list(region) });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "unauthorized") return 401;
  if (code === "validation_failed") return 400;
  return 500;
}
