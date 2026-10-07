import { AuthService } from "./security/auth";
import { authenticateRequest } from "./security/security-middleware";
import { EndpointApi } from "./api/endpoint-api";
import { EndpointService } from "./core/endpoint-service";
import { D1EndpointRepository } from "./repositories/endpoint-repository";
import { UserApi } from "./api/user-api";
import { DeviceApi } from "./api/device-api";
import { ConfigApi } from "./api/config-api";
import { ConfigService } from "./core/config-service";
import { D1ConfigRepository } from "./repositories/config-repository";
import { TemplateApi } from "./api/template-api";
import { TemplateService } from "./core/template-service";
import { D1TemplateRepository } from "./repositories/template-repository";
import { UserService } from "./core/user-service";
import { DeviceService } from "./core/device-service";
import { D1UserRepository } from "./repositories/user-repository";
import { D1DeviceRepository } from "./repositories/device-repository";
import { SubscriptionApi } from "./api/subscription-api";
import { SubscriptionService } from "./core/subscription-service";
import { D1SubscriptionRepository } from "./repositories/subscription-repository";
import type { Endpoint } from "./models/endpoint";
import { KvRateLimiter } from "./security/kv-rate-limit";
import { EmergencyLock } from "./security/emergency-lock";

export interface Env {
  AUTH_SECRET: string;
  DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  SECURITY_KV?: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "sakurapanel" });
    }

    if (!env.DB && url.pathname.startsWith("/internal/")) {
      return Response.json({ ok: false, error: "database_not_configured" }, { status: 503 });
    }

    if (env.RATE_LIMIT_KV && url.pathname.startsWith("/internal/")) {
      const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const decision = await new KvRateLimiter(env.RATE_LIMIT_KV).check(clientKey, 120, 60_000);
      if (!decision.allowed) return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(decision.retryAfterSeconds ?? 1) } });
    }

    if (env.SECURITY_KV) {
      try { await new EmergencyLock(env.SECURITY_KV).assertUnlocked(); }
      catch { return Response.json({ ok: false, error: "emergency_lock_active" }, { status: 503 }); }
    }

    if (!env.AUTH_SECRET) {
      return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });
    }

    const auth = new AuthService(env.AUTH_SECRET);
    const context = await authenticateRequest(request, auth, env.DB);
    const endpointService = new EndpointService(new D1EndpointRepository(env.DB!));
    const endpointApi = new EndpointApi(endpointService);
    const templateRepository = new D1TemplateRepository(env.DB!);
    const templateService = new TemplateService(templateRepository);
    const templateApi = new TemplateApi(templateService);
    const deviceRepository = new D1DeviceRepository(env.DB!);
    const configService = new ConfigService(new D1ConfigRepository(env.DB!), endpointService, templateRepository, undefined, deviceRepository);
    const configApi = new ConfigApi(configService);
    const subscriptionRepository = new D1SubscriptionRepository(env.DB!);
    const subscriptionService = new SubscriptionService(
      subscriptionRepository,
      new D1ConfigRepository(env.DB!),
      endpointService,
      configService
    );
    const subscriptionApi = new SubscriptionApi(subscriptionService);

    if (url.pathname === "/internal/endpoints") {
      if (request.method === "GET") {
        return endpointApi.list(context, url.searchParams.get("region") ?? undefined);
      }

      if (request.method === "POST") {
        let endpoint: Endpoint;
        try {
          endpoint = await request.json<Endpoint>();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        return endpointApi.create(context, endpoint);
      }
    }

    if (url.pathname === "/internal/templates" && request.method === "GET") {
      return templateApi.list(context);
    }

    if (url.pathname === "/internal/templates" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return templateApi.create(context, body);
    }

    const templateStatusMatch = url.pathname.match(/^\/internal\/templates\/([^/]+)\/status$/);
    if (templateStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return templateApi.updateStatus(context, decodeURIComponent(templateStatusMatch[1]), body);
    }

    if (url.pathname === "/internal/subscriptions" && request.method === "GET") {
      return subscriptionApi.list(context, url.searchParams.get("userId") ?? undefined);
    }

    if (url.pathname === "/internal/subscriptions" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.create(context, body);
    }

    const subscriptionMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)$/);
    if (subscriptionMatch && request.method === "GET") {
      return subscriptionApi.get(context, decodeURIComponent(subscriptionMatch[1]));
    }

    const subscriptionProvisionMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/provision$/);
    if (subscriptionProvisionMatch && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.provision(context, decodeURIComponent(subscriptionProvisionMatch[1]), body);
    }

    const subscriptionRebuildMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/rebuild$/);
    if (subscriptionRebuildMatch && request.method === "POST") {
      return subscriptionApi.rebuild(context, decodeURIComponent(subscriptionRebuildMatch[1]));
    }

    const subscriptionStatusMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/status$/);
    if (subscriptionStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.updateStatus(context, decodeURIComponent(subscriptionStatusMatch[1]), body);
    }

    if (url.pathname === "/internal/configs" && request.method === "GET") {
      return configApi.list(context, url.searchParams.get("userId") ?? undefined);
    }

    if (url.pathname === "/internal/configs" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return configApi.generate(context, body);
    }

    const configMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)$/);
    if (configMatch && request.method === "GET") {
      return configApi.get(context, decodeURIComponent(configMatch[1]));
    }

    const configStatusMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)\/status$/);
    if (configStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return configApi.updateStatus(context, decodeURIComponent(configStatusMatch[1]), body);
    }
    const userRepository = new D1UserRepository(env.DB!);
    const userService = new UserService(userRepository);
    const deviceService = new DeviceService(
      deviceRepository,
      userRepository
    );
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
