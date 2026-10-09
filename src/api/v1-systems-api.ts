import type { ConfigRepository } from "../repositories/config-repository";
import { exportConfigs, rankRoutes, timeBounded, type StudioFormat } from "../core/v1-systems";
import { runPulse } from "../core/v1-diagnostics";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import type { Env } from "../types/env";

export class V1SystemsApi {
  constructor(private readonly configs: ConfigRepository) {}

  async configStudio(context: SecurityContext | null, env: Env, params: URLSearchParams): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const requestedUser = params.get("userId")?.trim();
      const userId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : (requestedUser || ctx.principal.userId);
      if (!userId || userId.length > 128) throw new Error("validation_failed");
      const format = (params.get("format") || "json") as StudioFormat;
      const configs = await this.configs.listByUserId(userId);
      const result = exportConfigs(configs, format);
      return Response.json({
        ok: true,
        value: {
          format: result.format,
          count: result.count,
          contentType: result.contentType,
          filename: result.filename,
          body: result.body,
          excluded: result.excluded
        }
      }, { headers: { "cache-control": "no-store", "content-disposition": `attachment; filename="${result.filename}"` } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async pulse(context: SecurityContext | null, env: Env): Promise<Response> {
    try {
      requirePermission(context, "security:manage");
      const report = await runPulse(env);
      return Response.json({ ok: report.status === "passed", value: report }, {
        status: report.status === "passed" ? 200 : report.status === "failed" ? 503 : 424,
        headers: { "cache-control": "no-store" }
      });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async speed(context: SecurityContext | null, env: Env): Promise<Response> {
    try {
      requirePermission(context, "security:manage");
      if (!env.DB) return Response.json({ ok: false, error: "database_not_configured" }, { status: 503 });
      const database = await timeBounded(async () => {
        await env.DB!.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return true;
      }, 1500);
      const serialization = await timeBounded(async () => {
        const sample = { timestamp: new Date().toISOString(), operation: "diagnostic_serialization", ok: true };
        return JSON.stringify(sample).length;
      }, 250);
      const value = {
        measuredAt: new Date().toISOString(),
        methodology: "single bounded diagnostic sample; not a benchmark",
        sampleCount: 1,
        measurements: [
          { operation: "database_select_1", scope: "server_database_operation", ok: database.ok, durationMs: database.durationMs, ...(database.error ? { error: database.error } : {}) },
          { operation: "json_serialization", scope: "server_local_operation", ok: serialization.ok, durationMs: serialization.durationMs, ...(serialization.ok ? { outputBytes: serialization.value } : { error: serialization.error }) }
        ],
        platformMetrics: { status: "unavailable", detail: "Cloudflare platform analytics are not exposed through the configured Worker bindings." },
        warning: "This is one diagnostic sample, not a statistically reliable performance benchmark."
      };
      const ok = value.measurements.every(item => item.ok);
      return Response.json({ ok, value }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }

  async routeAdvisor(context: SecurityContext | null, env: Env): Promise<Response> {
    try {
      requirePermission(context, "security:manage");
      // Migration 0016 intentionally removed the legacy endpoints/endpoint_health model.
      // No current supported route-candidate repository exists, so inventing candidates
      // or reusing unrelated config records would produce unsafe recommendations.
      const result = rankRoutes([], new Date().toISOString());
      return Response.json({
        ok: true,
        value: {
          ...result,
          candidates: [],
          source: "no_route_candidate_model",
          detail: "The current schema intentionally has no endpoint or endpoint-health table. Configure a supported route model before recommendations can be computed."
        }
      }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "validation_failed" || code === "unsupported_export_format" || code === "export_limit_exceeded" || code === "invalid_timestamp") return 400;
  return 500;
}

function errorResponse(error: unknown, status: number): Response {
  const code = error instanceof Error ? error.message : "";
  const safeCode = ["forbidden", "validation_failed", "unsupported_export_format", "export_limit_exceeded", "invalid_timestamp"].includes(code)
    ? code : "internal_error";
  return Response.json({ ok: false, error: safeCode }, { status, headers: { "cache-control": "no-store" } });
}
