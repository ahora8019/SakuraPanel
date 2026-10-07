import { EndpointRegistry } from "./core/endpoint-registry";
import { AuthService } from "./security/auth";
import { authenticateRequest } from "./security/security-middleware";
import { EndpointApi } from "./api/endpoint-api";
import type { Endpoint } from "./models/endpoint";

export interface Env {
  AUTH_SECRET: string;
  DB?: D1Database;
}

const registry = new EndpointRegistry();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "sakurapanel" });
    }

    if (url.pathname === "/internal/endpoints" && !env.DB) {
      return Response.json(
        { ok: false, error: "database_not_configured" },
        { status: 503 }
      );
    }

    if (!env.AUTH_SECRET) {
      return Response.json(
        { ok: false, error: "service_not_configured" },
        { status: 503 }
      );
    }

    const auth = new AuthService(env.AUTH_SECRET);
    const context = await authenticateRequest(request, auth, env.DB);
    const endpointApi = new EndpointApi(registry);

    if (url.pathname === "/internal/endpoints") {
      if (request.method === "GET") {
        return endpointApi.list(context);
      }

      if (request.method === "POST") {
        let endpoint: Endpoint;

        try {
          endpoint = await request.json<Endpoint>();
        } catch {
          return Response.json(
            { ok: false, error: "invalid_json" },
            { status: 400 }
          );
        }

        return endpointApi.create(context, endpoint);
      }
    }

    return Response.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
};
