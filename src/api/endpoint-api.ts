import type { Endpoint } from "../models/endpoint";
import { EndpointService } from "../core/endpoint-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";

export class EndpointApi {
  constructor(private readonly service: EndpointService) {}

  async create(context: SecurityContext | null, endpoint: Endpoint): Promise<Response> {
    try {
      requirePermission(context, "endpoint:write");
      const result = await this.service.create(endpoint);
      if (!result.ok) {
        const status = result.error === "endpoint_already_exists" ? 409 : 400;
        return Response.json(result, { status });
      }
      return Response.json(result, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : "internal_error";
      return Response.json(
        { ok: false, error: code === "forbidden" ? "forbidden" : "unauthorized" },
        { status: code === "forbidden" ? 403 : 401 }
      );
    }
  }

  async list(context: SecurityContext | null, region?: string): Promise<Response> {
    try {
      requirePermission(context, "endpoint:read");
      return Response.json({ ok: true, value: await this.service.list(region) });
    } catch {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
}
