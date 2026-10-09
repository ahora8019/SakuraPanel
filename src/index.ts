import { AuthService } from "./security/auth";
import { authenticateRequest } from "./security/security-middleware";
import { UserApi } from "./api/user-api";
import { DeviceApi } from "./api/device-api";
import { ConfigApi } from "./api/config-api";
import { ConfigReleaseApi } from "./api/config-release-api";
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
import { PublicSubscriptionApi } from "./api/public-subscription-api";
import { SubscriptionDeliveryService } from "./core/subscription-delivery";
import { SubscriptionService } from "./core/subscription-service";
import { D1SubscriptionRepository } from "./repositories/subscription-repository";
import { KvRateLimiter } from "./security/kv-rate-limit";
import { EmergencyLock } from "./security/emergency-lock";
import { D1SessionRepository } from "./repositories/session-repository";
import { ownerDashboardResponse } from "./ui/owner-dashboard";
import { cleanupRateLimitBuckets } from "./security/rate-limit-cleanup";
import { runDiagnostics, runReadiness } from "./core/diagnostics";
import { DiagnosticsApi } from "./api/diagnostics-api";
import { ConfigReleaseService } from "./core/config-release-service";
import { D1ConfigReleaseRepository } from "./repositories/config-release-repository";
import { D1AuditRepository } from "./repositories/audit-repository";
import { SubscriptionDiagnosticsService } from "./core/subscription-diagnostics";
import { SubscriptionDiagnosticsApi } from "./api/subscription-diagnostics-api";
import { AuditApi } from "./api/audit-api";
import { V1SystemsApi } from "./api/v1-systems-api";
import { ownerLabsResponse } from "./ui/owner-labs";
import { runScheduledPulse } from "./core/scheduled-pulse";
import { cleanupRouteHealthSamples } from "./core/route-health-cleanup";
import { cleanupOperationTimingSamples } from "./core/operation-timing";

import type { Env } from "./types/env";

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    if (!env.DB) return;
    await runScheduledPulse(env, _controller.scheduledTime);
    await cleanupRateLimitBuckets(env.DB);
    await cleanupRouteHealthSamples(env.DB);
    await cleanupOperationTimingSamples(env.DB);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const requestId = crypto.randomUUID();
      console.log(JSON.stringify({ event: "request", requestId, method: request.method, path: url.pathname }));
      return Response.json({ ok: true, service: "sakurapanel", requestId }, {
        headers: { "cache-control": "no-store", "x-request-id": requestId }
      });
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      const requestId = crypto.randomUUID();
      const readiness = await runReadiness(env);
      return Response.json({
        ok: readiness.ok,
        service: "sakurapanel",
        requestId,
        checks: {
          database: readiness.database.status,
          securityControl: readiness.securityControl.status,
          authentication: readiness.authentication.status
        }
      }, {
        status: readiness.ok ? 200 : 503,
        headers: { "cache-control": "no-store", "x-request-id": requestId }
      });
    }

    // Static diagnostics shell stays available during Emergency Lock; its APIs remain authenticated.
    if (request.method === "GET" && url.pathname === "/owner/labs") {
      return ownerLabsResponse();
    }

    if (!env.DB && url.pathname.startsWith("/internal/")) {
      return Response.json({ ok: false, error: "database_not_configured" }, { status: 503 });
    }

    if (env.DB && url.pathname.startsWith("/internal/")) {
      const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const decision = await new KvRateLimiter(env.DB).check(clientKey, 120, 60_000);
      if (!decision.allowed) {
        return Response.json(
          { ok: false, error: "rate_limited" },
          { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds ?? 1), "cache-control": "no-store" } }
        );
      }
    }

    const readOnlyDiagnosticPath = request.method === "GET" && (url.pathname === "/internal/pulse" || url.pathname === "/internal/pulse/history" || url.pathname === "/internal/diagnostics");

    if (!env.SECURITY_KV && !readOnlyDiagnosticPath) {
      return Response.json({ ok: false, error: "security_control_not_configured" }, {
        status: 503,
        headers: { "cache-control": "no-store" }
      });
    }

    try {
      if (env.SECURITY_KV && !readOnlyDiagnosticPath) await new EmergencyLock(env.SECURITY_KV).assertUnlocked();
    } catch {
      return Response.json({ ok: false, error: "emergency_lock_active" }, {
        status: 503,
        headers: { "cache-control": "no-store" }
      });
    }

    const publicSubscriptionMatch = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{43})$/);
    if (env.DB && publicSubscriptionMatch && request.method === "GET") {
      const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const decision = await new KvRateLimiter(env.DB).check(`public:${clientKey}`, 60, 60_000);
      if (!decision.allowed) {
        return Response.json({ ok: false, error: "rate_limited" }, {
          status: 429,
          headers: {
            "retry-after": String(decision.retryAfterSeconds ?? 1),
            "cache-control": "no-store"
          }
        });
      }

      const publicSubscriptionApi = new PublicSubscriptionApi(
        new SubscriptionDeliveryService(
          new D1SubscriptionRepository(env.DB),
          new D1ConfigRepository(env.DB)
        )
      );
      return publicSubscriptionApi.get(publicSubscriptionMatch[1]);
    }

    if (!env.AUTH_SECRET) {
      return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });
    }

    const auth = new AuthService(env.AUTH_SECRET);

    if (url.pathname === "/bootstrap" && request.method === "GET") {
      return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SakuraPanel Bootstrap</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:40px auto;padding:20px;background:#111;color:#fff}
input,button{width:100%;box-sizing:border-box;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #555;background:#1d1d1d;color:#fff}
button{background:#e85d9e;border:0;font-weight:700}pre{white-space:pre-wrap;word-break:break-word}
</style></head><body>
<h2>🌸 SakuraPanel Owner Bootstrap</h2>
<p>Creates the first OWNER only. This page uses HTTPS and does not put the bootstrap secret in the URL.</p>
<form id="f">
<input id="u" value="ahora_8019" autocomplete="username" required>
<input id="s" type="password" placeholder="Bootstrap secret" autocomplete="off" required>
<button>Create OWNER</button>
</form><pre id="out"></pre>
<script>
document.getElementById("f").addEventListener("submit",async(e)=>{
 e.preventDefault(); const out=document.getElementById("out"); out.textContent="Working...";
 try{
  const r=await fetch("/internal/bootstrap",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({username:document.getElementById("u").value,bootstrapSecret:document.getElementById("s").value})});
  const j=await r.json(); if(j?.value?.token) j.value.token="TOKEN_CREATED_IN_BROWSER_DO_NOT_SHARE";
  out.textContent=JSON.stringify({status:r.status,...j},null,2);
 }catch(err){out.textContent=String(err)}
});
</script></body></html>`, {
        headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" }
      });
    }

    if (url.pathname === "/owner" && request.method === "GET") {
      return ownerDashboardResponse();
    }

    if (env.DB && (
      (url.pathname === "/owner/login" && request.method === "POST") ||
      (url.pathname === "/internal/bootstrap" && request.method === "POST") ||
      (url.pathname === "/internal/bootstrap/session" && request.method === "POST")
    )) {
      const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const decision = await new KvRateLimiter(env.DB).check(`auth:${clientKey}`, 10, 60_000);
      if (!decision.allowed) {
        return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": String(decision.retryAfterSeconds ?? 1), "cache-control": "no-store" }
        });
      }
    }

    if (url.pathname === "/owner/logout" && request.method === "POST") {
      if (!env.DB) return new Response("Service not configured", { status: 503, headers: { "cache-control": "no-store" } });
      const token = AuthService.extractBearer(request);
      if (token) {
        const principal = await auth.verifyToken(token);
        if (principal) await new D1SessionRepository(env.DB).revoke(principal.sessionId, new Date().toISOString());
      }
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/owner",
          "Set-Cookie": "sp_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/owner/login" && request.method === "POST") {
      if (!env.DB || !env.BOOTSTRAP_SECRET) return new Response("Service not configured", { status: 503 });

      let form: FormData;
      try { form = await request.formData(); }
      catch { return new Response("Invalid request", { status: 400 }); }

      const username = String(form.get("username") ?? "").trim();
      const bootstrapSecret = String(form.get("bootstrapSecret") ?? "");
      if (!username || bootstrapSecret !== env.BOOTSTRAP_SECRET) return new Response("Unauthorized", { status: 401 });

      const owner = await env.DB.prepare(
        "SELECT id, username, role, status, security_version FROM users WHERE username = ? AND role = 'OWNER' LIMIT 1"
      ).bind(username).first<{id:string;username:string;role:"OWNER";status:"ACTIVE";security_version:number}>();

      if (!owner || owner.status !== "ACTIVE") return new Response("Owner not available", { status: 403 });

      const now = new Date();
      const nowIso = now.toISOString();
      const expires = new Date(now.getTime() + 60 * 60 * 1000);
      const sessionId = crypto.randomUUID();
      const token = await auth.issueToken({
        userId: owner.id, role: "OWNER", sessionId, tokenVersion: 1, securityVersion: owner.security_version
      }, 3600, Math.floor(now.getTime() / 1000));

      await env.DB.prepare(
        "INSERT INTO auth_sessions (id, user_id, token_version, created_at, expires_at, revoked_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL, ?)"
      ).bind(sessionId, owner.id, 1, nowIso, expires.toISOString(), nowIso).run();

      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/owner",
          "Set-Cookie": `sp_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`,
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/internal/bootstrap" && request.method === "POST") {
      if (!env.DB || !env.BOOTSTRAP_SECRET) return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });

      const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
      if ((existing?.count ?? 0) > 0) return Response.json({ ok: false, error: "bootstrap_already_completed" }, { status: 409 });

      let body: unknown;
      try {
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) body = await request.json();
        else if (contentType.includes("application/x-www-form-urlencoded")) {
          const form = await request.formData();
          body = { username: form.get("username"), bootstrapSecret: form.get("bootstrapSecret") };
        } else return Response.json({ ok: false, error: "invalid_content_type" }, { status: 415 });
      } catch {
        return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      }

      if (!body || typeof body !== "object" ||
          typeof (body as Record<string, unknown>).username !== "string" ||
          typeof (body as Record<string, unknown>).bootstrapSecret !== "string") {
        return Response.json({ ok: false, error: "validation_failed" }, { status: 400 });
      }

      if ((body as Record<string, unknown>).bootstrapSecret !== env.BOOTSTRAP_SECRET) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }

      const username = ((body as Record<string, unknown>).username as string).trim();
      if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        return Response.json({ ok: false, error: "validation_failed" }, { status: 400 });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const userId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const expiresIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const user = { id: userId, username, role: "OWNER", status: "ACTIVE", securityVersion: 1, createdAt: nowIso, updatedAt: nowIso };

      const token = await auth.issueToken({
        userId, role: "OWNER", sessionId, tokenVersion: 1, securityVersion: 1
      }, 3600, Math.floor(now.getTime() / 1000));

      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO users (id, username, role, status, security_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(userId, username, "OWNER", "ACTIVE", 1, nowIso, nowIso),
          env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_version, created_at, expires_at, revoked_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL, ?)")
            .bind(sessionId, userId, 1, nowIso, expiresIso, nowIso)
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("unique") || message.includes("constraint")) {
          return Response.json({ ok: false, error: "bootstrap_already_completed" }, { status: 409 });
        }
        throw error;
      }

      return Response.json({ ok: true, value: { user, session: { expiresAt: expiresIso }, token } }, { status: 201 });
    }

    if (url.pathname === "/internal/bootstrap/session" && request.method === "POST") {
      if (!env.DB || !env.BOOTSTRAP_SECRET) return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });

      let body: unknown;
      try {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("application/x-www-form-urlencoded")) {
          return Response.json({ ok: false, error: "invalid_content_type" }, { status: 415 });
        }
        const form = await request.formData();
        body = { username: form.get("username"), bootstrapSecret: form.get("bootstrapSecret") };
      } catch {
        return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      }

      if (!body || typeof body !== "object" ||
          typeof (body as Record<string, unknown>).username !== "string" ||
          typeof (body as Record<string, unknown>).bootstrapSecret !== "string") {
        return Response.json({ ok: false, error: "validation_failed" }, { status: 400 });
      }

      if ((body as Record<string, unknown>).bootstrapSecret !== env.BOOTSTRAP_SECRET) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }

      const username = ((body as Record<string, unknown>).username as string).trim();
      const existingUsers = await env.DB.prepare("SELECT 1 AS present FROM users LIMIT 1").first<{ present: number }>();
      if (existingUsers) return Response.json({ ok: false, error: "bootstrap_already_completed" }, { status: 409 });

      const owner = await env.DB.prepare(
        "SELECT id, username, role, status, security_version FROM users WHERE username = ? AND role = 'OWNER' LIMIT 1"
      ).bind(username).first<{id:string;username:string;role:"OWNER";status:"ACTIVE";security_version:number}>();

      if (!owner || owner.status !== "ACTIVE") return Response.json({ ok: false, error: "owner_not_available" }, { status: 403 });

      const now = new Date();
      const nowIso = now.toISOString();
      const expiresIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const sessionId = crypto.randomUUID();
      const token = await auth.issueToken({
        userId: owner.id, role: "OWNER", sessionId, tokenVersion: 1, securityVersion: owner.security_version
      }, 3600, Math.floor(now.getTime() / 1000));

      await env.DB.prepare(
        "INSERT INTO auth_sessions (id, user_id, token_version, created_at, expires_at, revoked_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL, ?)"
      ).bind(sessionId, owner.id, 1, nowIso, expiresIso, nowIso).run();

      return Response.json({
        ok: true,
        value: { user: { id: owner.id, username: owner.username, role: owner.role }, session: { expiresAt: expiresIso }, token }
      }, { status: 201 });
    }

    const context = await authenticateRequest(request, auth, env.DB);
    const userRepository = new D1UserRepository(env.DB!);
    const deviceRepository = new D1DeviceRepository(env.DB!);
    const templateRepository = new D1TemplateRepository(env.DB!);
    const configRepository = new D1ConfigRepository(env.DB!);
    const subscriptionRepository = new D1SubscriptionRepository(env.DB!);

    const userService = new UserService(userRepository);
    const deviceService = new DeviceService(deviceRepository, userRepository);
    const templateService = new TemplateService(templateRepository);
    const configService = new ConfigService(configRepository, templateRepository, undefined, deviceRepository, userRepository);
    const subscriptionService = new SubscriptionService(
      subscriptionRepository, configRepository, configService, userRepository
    );

    const userApi = new UserApi(userService);
    const deviceApi = new DeviceApi(deviceService);
    const templateApi = new TemplateApi(templateService);
    const configApi = new ConfigApi(configService, env.DB!);
    const configReleaseService = new ConfigReleaseService(
      configRepository,
      new D1ConfigReleaseRepository(env.DB!),
      userRepository,
      new D1AuditRepository(env.DB!)
    );
    const configReleaseApi = new ConfigReleaseApi(configReleaseService);
    const subscriptionApi = new SubscriptionApi(subscriptionService, env.DB!);
    const subscriptionDiagnosticsApi = new SubscriptionDiagnosticsApi(
      new SubscriptionDiagnosticsService(subscriptionRepository, configRepository)
    );
    const diagnosticsApi = new DiagnosticsApi();
    const auditApi = new AuditApi(new D1AuditRepository(env.DB!));
    const v1SystemsApi = new V1SystemsApi(configRepository, subscriptionRepository);

    if (url.pathname === "/internal/diagnostics" && request.method === "GET") {
      return diagnosticsApi.get(context, env);
    }
    if (url.pathname === "/internal/config-studio" && request.method === "GET") {
      return v1SystemsApi.configStudio(context, env, url.searchParams);
    }
    if (url.pathname === "/internal/pulse" && request.method === "GET") {
      return v1SystemsApi.pulse(context, env);
    }
    if (url.pathname === "/internal/pulse/history" && request.method === "GET") {
      return v1SystemsApi.pulseHistory(context, env, url.searchParams);
    }
    if (url.pathname === "/internal/speed" && request.method === "POST") {
      return v1SystemsApi.speed(context, env);
    }
    if (url.pathname === "/internal/route-advisor" && request.method === "GET") {
      return v1SystemsApi.routeAdvisor(context, env);
    }

    if (url.pathname === "/internal/audit" && request.method === "GET") {
      return auditApi.list(context, url.searchParams);
    }

    if (url.pathname === "/internal/templates" && request.method === "GET") return templateApi.list(context);
    if (url.pathname === "/internal/templates" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return templateApi.create(context, body);
    }

    const templateStatusMatch = url.pathname.match(/^\/internal\/templates\/([^/]+)\/status$/);
    if (templateStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return templateApi.updateStatus(context, decodeURIComponent(templateStatusMatch[1]), body);
    }

    if (url.pathname === "/internal/configs" && request.method === "GET") {
      return configApi.list(context, url.searchParams.get("userId") ?? undefined);
    }
    if (url.pathname === "/internal/configs" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return configApi.generate(context, body);
    }

    const configMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)$/);
    if (configMatch && request.method === "GET") return configApi.get(context, decodeURIComponent(configMatch[1]));

    const configReleaseListMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)\/releases$/);
    if (configReleaseListMatch && request.method === "GET") {
      return configReleaseApi.list(context, decodeURIComponent(configReleaseListMatch[1]));
    }

    const configReleasePublishMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)\/releases\/publish$/);
    if (configReleasePublishMatch && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      const version = body && typeof body === "object" ? Number((body as Record<string, unknown>).version) : NaN;
      return configReleaseApi.publish(context, decodeURIComponent(configReleasePublishMatch[1]), version);
    }

    const configReleaseRollbackMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)\/releases\/rollback$/);
    if (configReleaseRollbackMatch && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      const version = body && typeof body === "object" ? Number((body as Record<string, unknown>).version) : NaN;
      return configReleaseApi.rollback(context, decodeURIComponent(configReleaseRollbackMatch[1]), version);
    }

    const configStatusMatch = url.pathname.match(/^\/internal\/configs\/([^/]+)\/status$/);
    if (configStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return configApi.updateStatus(context, decodeURIComponent(configStatusMatch[1]), body);
    }

    if (url.pathname === "/internal/subscriptions" && request.method === "GET") {
      return subscriptionApi.list(context, url.searchParams.get("userId") ?? undefined);
    }
    if (url.pathname === "/internal/subscriptions" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.create(context, body);
    }

    const subscriptionDiagnosticsMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/diagnostics$/);
    if (subscriptionDiagnosticsMatch && request.method === "GET") {
      return subscriptionDiagnosticsApi.get(context, decodeURIComponent(subscriptionDiagnosticsMatch[1]));
    }

    const subscriptionTokenRotateMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/token\/rotate$/);
    if (subscriptionTokenRotateMatch && request.method === "POST") {
      return subscriptionApi.rotateToken(context, decodeURIComponent(subscriptionTokenRotateMatch[1]));
    }

    const subscriptionMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)$/);
    if (subscriptionMatch && request.method === "GET") return subscriptionApi.get(context, decodeURIComponent(subscriptionMatch[1]));

    const subscriptionProvisionMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/provision$/);
    if (subscriptionProvisionMatch && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.provision(context, decodeURIComponent(subscriptionProvisionMatch[1]), body);
    }

    const subscriptionRebuildMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/rebuild$/);
    if (subscriptionRebuildMatch && request.method === "POST") return subscriptionApi.rebuild(context, decodeURIComponent(subscriptionRebuildMatch[1]));

    const subscriptionStatusMatch = url.pathname.match(/^\/internal\/subscriptions\/([^/]+)\/status$/);
    if (subscriptionStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return subscriptionApi.updateStatus(context, decodeURIComponent(subscriptionStatusMatch[1]), body);
    }

    if (url.pathname === "/internal/users" && request.method === "GET") return userApi.list(context);
    if (url.pathname === "/internal/users" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return userApi.create(context, body);
    }

    const userStatusMatch = url.pathname.match(/^\/internal\/users\/([^/]+)\/status$/);
    if (userStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return userApi.updateStatus(context, decodeURIComponent(userStatusMatch[1]), body);
    }

    const userDevicesMatch = url.pathname.match(/^\/internal\/users\/([^/]+)\/devices$/);
    if (userDevicesMatch && request.method === "GET") return deviceApi.list(context, decodeURIComponent(userDevicesMatch[1]));

    if (url.pathname === "/internal/devices" && request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return deviceApi.create(context, body);
    }

    const deviceStatusMatch = url.pathname.match(/^\/internal\/devices\/([^/]+)\/status$/);
    if (deviceStatusMatch && request.method === "PATCH") {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
      return deviceApi.updateStatus(context, decodeURIComponent(deviceStatusMatch[1]), body);
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
};
