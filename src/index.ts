import { EndpointRegistry } from "./core/endpoint-registry";
import { AuthService } from "./security/auth";
import { authenticateRequest } from "./security/security-middleware";
import { EndpointApi } from "./api/endpoint-api";
import { UserApi } from "./api/user-api";
import { DeviceApi } from "./api/device-api";
import { UserService } from "./core/user-service";
import { DeviceService } from "./core/device-service";
import { D1UserRepository } from "./repositories/user-repository";
import { D1DeviceRepository } from "./repositories/device-repository";
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

    if (!env.DB) {
      if (url.pathname.startsWith("/internal/")) {
        return Response.json({ ok: false, error: "database_not_configured" }, { status: 503 });
      }
    }

    if (!env.AUTH_SECRET) {
      return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });
    }

    const auth = new AuthService(env.AUTH_SECRET);
    const context = await authenticateRequest(request, auth, env.DB);
    const endpointApi = new EndpointApi(registry);

    if (url.pathname === "/internal/endpoints") {
      if (request.method === "GET") return endpointApi.list(context);

      if (request.method === "POST") {
        let endpoint: Endpoint;
        try { endpoint = await request.json<Endpoint>(); }
        catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
        return endpointApi.create(context, endpoint);
      }
    }

    const userService = new UserService(new D1UserRepository(env.DB!));
    const deviceService = new DeviceService(new D1DeviceRepository(env.DB!), new D1UserRepository(env.DB!));
    const userApi = new UserApi(userService);
    const deviceApi = new DeviceApi(deviceService);

    if (url.pathname === "/internal/users" && request.method === "GET") {
      return userApi.list(context);
    }

    if (url.pathname === "/internal/users" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return userApi.create(context, body);
    }

    const userStatusMatch = url.pathname.match(/^\/internal\/users\/([^/]+)\/status$/);
    if (userStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return userApi.updateStatus(context, decodeURIComponent(userStatusMatch[1]), body);
    }

    const userDevicesMatch = url.pathname.match(/^\/internal\/users\/([^/]+)\/devices$/);
    if (userDevicesMatch && request.method === "GET") {
      return deviceApi.list(context, decodeURIComponent(userDevicesMatch[1]));
    }

    if (url.pathname === "/internal/devices" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return deviceApi.create(context, body);
    }

    const deviceStatusMatch = url.pathname.match(/^\/internal\/devices\/([^/]+)\/status$/);
    if (deviceStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return deviceApi.updateStatus(context, decodeURIComponent(deviceStatusMatch[1]), body);
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
};
