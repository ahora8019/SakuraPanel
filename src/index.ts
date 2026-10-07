import { EndpointRegistry } from "./core/endpoint-registry";
import { validateEndpoint } from "./core/validation-engine";
import type { Endpoint } from "./models/endpoint";

export interface Env {}

const registry = new EndpointRegistry();

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "sakurapanel" });
    }

    if (request.method === "POST" && url.pathname === "/internal/endpoints") {
      let endpoint: Endpoint;

      try {
        endpoint = await request.json<Endpoint>();
      } catch {
        return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
      }

      const validation = validateEndpoint(endpoint);
      if (!validation.valid) {
        return Response.json(
          { ok: false, error: "validation_failed", details: validation.errors },
          { status: 400 }
        );
      }

      const result = registry.register(endpoint);
      if (!result.ok) {
        return Response.json(result, { status: 409 });
      }

      return Response.json(result, { status: 201 });
    }

    if (request.method === "GET" && url.pathname === "/internal/endpoints") {
      return Response.json({ ok: true, value: registry.list() });
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
};