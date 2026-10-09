import type { ConfigRepository } from "../repositories/config-repository";
import type { GeneratedConfig } from "../models/config";
import type { SubscriptionRepository } from "../repositories/subscription-repository";
import { exportConfigs, exportSubscriptionSnapshot, inspectConfig, rankRoutes, timeBounded, type StudioExport, type StudioFormat } from "../core/v1-systems";
import { runPulse } from "../core/v1-diagnostics";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import type { Env } from "../types/env";

export class V1SystemsApi {
  constructor(private readonly configs: ConfigRepository, private readonly subscriptions: SubscriptionRepository) {}

  async configStudio(context: SecurityContext | null, _env: Env, params: URLSearchParams): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const requestedUser = params.get("userId")?.trim();
      const userId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : (requestedUser || ctx.principal.userId);
      if (!userId || userId.length > 128) throw new Error("validation_failed");
      const rawFormat = params.get("format") || "json";
      if (rawFormat === "inspect") {
        const configs = await this.configs.listByUserId(userId);
        const limited = configs.slice(0, 100);
        const items = limited.map(config => {
          const inspection = inspectConfig(config);
          return {
            id: config.id,
            templateId: config.templateId,
            templateVersion: config.templateVersion,
            status: config.status,
            ...(config.expiresAt ? { expiresAt: config.expiresAt } : {}),
            createdAt: config.createdAt,
            state: inspection.state,
            reasons: inspection.reasons
          };
        });
        return Response.json({ ok: true, value: { items, total: configs.length, limit: 100, truncated: configs.length > 100 } }, {
          headers: { "cache-control": "no-store" }
        });
      }

      const format = rawFormat as StudioFormat;
      let result: StudioExport;

      if (format === "subscription") {
        const subscriptionId = params.get("subscriptionId")?.trim();
        if (!subscriptionId || subscriptionId.length > 128) throw new Error("validation_failed");
        const subscription = await this.subscriptions.findById(subscriptionId);
        if (!subscription || subscription.userId !== userId ||
            (ctx.principal.role === "MEMBER" && subscription.userId !== ctx.principal.userId)) {
          throw new Error("subscription_not_found");
        }
        const now = new Date().toISOString();
        if (subscription.status !== "ACTIVE") throw new Error("subscription_not_found");
        if (subscription.expiresAt) {
          const expiresAt = Date.parse(subscription.expiresAt);
          if (!Number.isFinite(expiresAt) || expiresAt <= Date.parse(now)) throw new Error("subscription_not_found");
        }
        const version = await this.subscriptions.getLatestVersion(subscription.id);
        if (!version || version.configIds.length === 0) throw new Error("no_eligible_configs");
        if (version.configIds.length > 100) throw new Error("export_limit_exceeded");
        const rows = await this.configs.listByIds(version.configIds);
        const byId = new Map(rows.map(config => [config.id, config]));
        const ordered = version.configIds.map(id => byId.get(id)).filter((config): config is GeneratedConfig => Boolean(config));
        if (ordered.some(config => config.userId !== subscription.userId)) throw new Error("subscription_not_found");
        result = exportSubscriptionSnapshot(ordered, version.version, subscription.expiresAt, now);
        if (result.count === 0) throw new Error("no_eligible_configs");
      } else {
        if (format !== "json" && format !== "links") throw new Error("unsupported_export_format");
        const requestedIds = params.get("ids");
        let configs: GeneratedConfig[];
        if (requestedIds !== null) {
          const ids = requestedIds.split(",").map(id => id.trim());
          if (ids.length === 0 || ids.length > 100 || ids.some(id => !id || id.length > 128) || new Set(ids).size !== ids.length) {
            throw new Error("validation_failed");
          }
          const rows = await this.configs.listByIds(ids);
          if (rows.length !== ids.length || rows.some(config => config.userId !== userId)) throw new Error("not_found");
          const byId = new Map(rows.map(config => [config.id, config]));
          configs = ids.map(id => byId.get(id)).filter((config): config is GeneratedConfig => Boolean(config));
        } else {
          configs = await this.configs.listByUserId(userId);
        }
        result = exportConfigs(configs, format);
      }

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
      }, { headers: { "cache-control": "no-store" } });
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

  async pulseHistory(context: SecurityContext | null, env: Env, params: URLSearchParams): Promise<Response> {
    try {
      requirePermission(context, "security:manage");
      if (!env.DB) return Response.json({ ok: false, error: "database_not_configured" }, { status: 503 });
      const rawLimit = params.get("limit");
      const limit = rawLimit === null ? 24 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("validation_failed");

      const last = await env.DB.prepare(
        "SELECT completed_at FROM system_check_runs WHERE status='passed' ORDER BY completed_at DESC LIMIT 1"
      ).first<{ completed_at: string | null }>();
      const rows = await env.DB.prepare(
        "SELECT id, scheduled_slot, status, started_at, completed_at, duration_ms, result_json FROM system_check_runs ORDER BY started_at DESC LIMIT ?"
      ).bind(limit).all<Record<string, unknown>>();
      const items = (rows.results ?? []).map(row => {
        let result: unknown = null;
        try {
          const parsed = JSON.parse(String(row.result_json ?? "{}")) as Record<string, unknown>;
          result = {
            status: parsed.status,
            measuredAt: parsed.measuredAt,
            durationMs: parsed.durationMs,
            checks: Array.isArray(parsed.checks) ? parsed.checks : []
          };
        } catch {
          result = { status: "unavailable", reason: "stored_result_malformed" };
        }
        return {
          id: String(row.id),
          scheduledSlot: String(row.scheduled_slot),
          status: String(row.status),
          startedAt: String(row.started_at),
          ...(row.completed_at == null ? {} : { completedAt: String(row.completed_at) }),
          durationMs: Number(row.duration_ms ?? 0),
          result
        };
      });
      return Response.json({
        ok: true,
        value: {
          status: "available",
          executionState: items.length ? items[0].status : "never_executed",
          lastSuccessfulAt: last?.completed_at ?? null,
          count: items.length,
          items
        }
      }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof Error && error.message === "validation_failed") return errorResponse(error, 400);
      return Response.json({ ok: false, error: "pulse_history_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
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
      if (!env.DB) {
        const result = rankRoutes([], new Date().toISOString());
        return Response.json({
          ok: true,
          value: {
            ...result,
            candidates: [],
            source: "route_candidate_model_unavailable",
            detail: "D1 is not configured; no route recommendation was produced."
          }
        }, { headers: { "cache-control": "no-store" } });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const cutoffIso = new Date(now.getTime() - 15 * 60_000).toISOString();
      let rows: Array<{
        id: string;
        compatible: number;
        healthy: number | null;
        latency_ms: number | null;
        error_rate: number | null;
        sample_count: number;
        measured_at: string | null;
      }>;
      try {
        const result = await env.DB.prepare(
          `SELECT c.id,
                  c.compatible,
                  CASE WHEN COUNT(s.id) = 0 THEN NULL ELSE MIN(s.healthy) END AS healthy,
                  AVG(s.latency_ms) AS latency_ms,
                  AVG(s.error_rate) AS error_rate,
                  COUNT(s.id) AS sample_count,
                  MAX(s.measured_at) AS measured_at
             FROM route_candidates c
             LEFT JOIN route_health_samples s
               ON s.route_id = c.id
              AND s.measured_at >= ?
              AND s.measured_at <= ?
            WHERE c.enabled = 1
            GROUP BY c.id, c.compatible
            ORDER BY c.id
            LIMIT 50`
        ).bind(cutoffIso, nowIso).all<{
          id: string;
          compatible: number;
          healthy: number | null;
          latency_ms: number | null;
          error_rate: number | null;
          sample_count: number;
          measured_at: string | null;
        }>();
        rows = result.results ?? [];
      } catch {
        return Response.json({
          ok: false,
          error: "route_candidate_model_unavailable",
          value: {
            decision: "insufficient_data",
            candidates: [],
            source: "route_candidate_model_unavailable",
            detail: "Apply the route candidate and health sample migrations before enabling Route Advisor."
          }
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }

      const evidence = rows.map(row => ({
        id: row.id,
        compatible: row.compatible === 1,
        healthy: row.healthy === null ? null : row.healthy === 1,
        latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
        errorRate: row.error_rate === null ? null : Number(row.error_rate),
        sampleCount: Number(row.sample_count),
        measuredAt: row.measured_at
      }));
      const result = rankRoutes(evidence, nowIso);
      return Response.json({
        ok: true,
        value: {
          ...result,
          source: "d1_route_health_samples",
          evidenceWindowMinutes: 15,
          candidateLimit: 50,
          detail: "Advisory only. At least three fresh samples per candidate are required; no route, config, or subscription is changed."
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
  if (code === "validation_failed" || code === "unsupported_export_format" || code === "export_limit_exceeded" || code === "invalid_timestamp" || code === "invalid_subscription_version") return 400;
  if (code === "subscription_not_found" || code === "no_eligible_configs" || code === "not_found") return 404;
  return 500;
}

function errorResponse(error: unknown, status: number): Response {
  const code = error instanceof Error ? error.message : "";
  const safeCode = ["forbidden", "validation_failed", "unsupported_export_format", "export_limit_exceeded", "invalid_timestamp", "invalid_subscription_version", "subscription_not_found", "no_eligible_configs", "not_found"].includes(code)
    ? code : "internal_error";
  return Response.json({ ok: false, error: safeCode }, { status, headers: { "cache-control": "no-store" } });
}
