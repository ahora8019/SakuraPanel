import { EndpointService } from "../core/endpoint-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";

export class HealthApi {
  constructor(private readonly endpoints: EndpointService) {}

  async observe(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      requirePermission(context, "endpoint:write");
      if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).healthy !== "boolean") {
        throw new Error("validation_failed");
      }
      const result = await this.endpoints.observeHealth({
        endpointId: id,
        healthy: (body as Record<string, unknown>).healthy as boolean,
        observedAt: new Date().toISOString()
      });
      if (!result.ok) throw new Error(result.error);
      return Response.json({ ok: true, value: result.value });
    } catch (error) {
      const code = error instanceof Error ? error.message : "internal_error";
      const status =
        code === "forbidden" ? 403 :
        code === "unauthorized" ? 401 :
        code === "endpoint_not_found" ? 404 :
        code === "validation_failed" ? 400 : 500;
      return Response.json({ ok: false, error: status === 500 ? "internal_error" : code }, { status });
    }
  }
}
