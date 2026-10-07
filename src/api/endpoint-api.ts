import type { Endpoint } from "../models/endpoint";
import { validateEndpoint } from "../core/validation-engine";
import { EndpointRegistry } from "../core/endpoint-registry";
import { requirePermission } from "../security/security-middleware";
import type { SecurityContext } from "../security/security-middleware";

export class EndpointApi {
  constructor(private readonly registry: EndpointRegistry) {}

  create(context: SecurityContext | null, endpoint: Endpoint): Response {
    try {
      requirePermission(context, "endpoint:write");

      const validation = validateEndpoint(endpoint);
      if (!validation.valid) {
        return Response.json(
          { ok: false, error: "validation_failed", details: validation.errors },
          { status: 400 }
        );
      }

      const result = this.registry.register(endpoint);

      if (!result.ok) {
        return Response.json(result, { status: 409 });
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

  list(context: SecurityContext | null): Response {
    try {
      requirePermission(context, "endpoint:read");
      return Response.json({ ok: true, value: this.registry.list() });
    } catch {
      return Response.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
  }
}