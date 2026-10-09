import type { GeneratedConfig } from "../models/config";
import { validateGeneratedConfig } from "./config-validation";

export type StudioState = "active" | "expired" | "disabled" | "invalid" | "sensitive";
export type StudioFormat = "json" | "links" | "subscription";

export interface StudioItem {
  config: GeneratedConfig;
  state: StudioState;
  reasons: string[];
}

const URI_SCHEMES = new Set(["vless:", "vmess:", "trojan:", "ss:"]);
const SENSITIVE_KEY = /(?:^|_)(?:secret|password|passwd|privatekey|private_key|admincredential|sessiontoken|authtoken|accesstoken|refresh_token)(?:$|_)/i;
const MAX_EXPORT_CONFIGS = 100;

function hasSensitiveField(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(item => hasSensitiveField(item, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    SENSITIVE_KEY.test(key.replace(/[-\s]/g, "_")) || hasSensitiveField(child, depth + 1)
  );
}

function validConnectionUri(config: GeneratedConfig): string | null {
  const candidates: unknown[] = [
    config.payload.uri,
    config.payload.url,
    config.payload.connectionUri,
    config.payload.connection_uri
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.length > 8192 || /[\r\n\0]/.test(candidate)) continue;
    try {
      const parsed = new URL(candidate);
      if (URI_SCHEMES.has(parsed.protocol)) return candidate;
    } catch {
      // The URL constructor rejects non-hierarchical URI forms used by these protocols.
      const scheme = candidate.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
      if (scheme && URI_SCHEMES.has(scheme + ":") && candidate.length > scheme.length + 3) return candidate;
    }
  }
  return null;
}

export function inspectConfig(config: GeneratedConfig, now = new Date().toISOString()): StudioItem {
  const reasons: string[] = [];
  const validation = validateGeneratedConfig(config);
  if (!validation.valid) reasons.push(...validation.errors);
  if (!config.payload || typeof config.payload !== "object" || Array.isArray(config.payload)) {
    reasons.push("payload_invalid");
  }
  if (reasons.length) return { config, state: "invalid", reasons };
  if (hasSensitiveField(config.payload)) return { config, state: "sensitive", reasons: ["sensitive_fields_excluded"] };
  const nowMs = Date.parse(now);
  if (config.status === "EXPIRED") return { config, state: "expired", reasons: ["configuration_expired"] };
  if (config.expiresAt) {
    const expiresAt = Date.parse(config.expiresAt);
    if (!Number.isFinite(expiresAt)) return { config, state: "invalid", reasons: ["invalid_expiration"] };
    if (expiresAt <= nowMs) return { config, state: "expired", reasons: ["configuration_expired"] };
  }
  if (config.status !== "ACTIVE") return { config, state: "disabled", reasons: ["configuration_not_active"] };
  return { config, state: "active", reasons: [] };
}

export interface StudioExport {
  format: StudioFormat;
  count: number;
  contentType: string;
  filename: string;
  body: string;
  excluded: Record<StudioState, number>;
}

export function exportConfigs(
  configs: GeneratedConfig[],
  format: StudioFormat,
  now = new Date().toISOString()
): StudioExport {
  if (!["json", "links", "subscription"].includes(format)) throw new Error("unsupported_export_format");
  if (configs.length > MAX_EXPORT_CONFIGS) throw new Error("export_limit_exceeded");
  if (!Number.isFinite(Date.parse(now))) throw new Error("invalid_timestamp");

  const inspected = configs.map(config => inspectConfig(config, now));
  const excluded: Record<StudioState, number> = { active: 0, expired: 0, disabled: 0, invalid: 0, sensitive: 0 };
  for (const item of inspected) if (item.state !== "active") excluded[item.state]++;

  const active = inspected.filter(item => item.state === "active").map(item => item.config);
  if (format === "json") {
    const body = JSON.stringify(active.map(config => ({
      id: config.id,
      templateId: config.templateId,
      templateVersion: config.templateVersion,
      status: config.status,
      ...(config.expiresAt ? { expiresAt: config.expiresAt } : {}),
      payload: config.payload
    })), null, 2);
    JSON.parse(body);
    return { format, count: active.length, contentType: "application/json; charset=utf-8", filename: "sakurapanel-configs.json", body, excluded };
  }

  const links = active.map(validConnectionUri).filter((value): value is string => value !== null);
  if (format === "links") {
    const body = links.join("\n");
    return { format, count: links.length, contentType: "text/plain; charset=utf-8", filename: "sakurapanel-links.txt", body, excluded: { ...excluded, invalid: excluded.invalid + active.length - links.length } };
  }

  // Subscription output follows the common UTF-8 + standard Base64 line-list form.
  // Only already-present, recognized connection URIs are emitted; SakuraPanel does not
  // synthesize protocol payloads or rewrite credentials.
  const plainText = links.join("\n");
  const bytes = new TextEncoder().encode(plainText);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const body = btoa(binary);
  return {
    format,
    count: links.length,
    contentType: "text/plain; charset=utf-8",
    filename: "sakurapanel-subscription.txt",
    body,
    excluded: { ...excluded, invalid: excluded.invalid + active.length - links.length }
  };
}

export interface TimedResult<T> {
  ok: boolean;
  durationMs: number;
  value?: T;
  error?: "timeout" | "operation_failed";
}

export async function timeBounded<T>(operation: () => Promise<T>, timeoutMs = 1500): Promise<TimedResult<T>> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error("invalid_timeout");
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    });
    const value = await Promise.race([operation(), timeout]);
    return { ok: true, durationMs: Math.max(0, performance.now() - started), value };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "timeout";
    return { ok: false, durationMs: Math.max(0, performance.now() - started), error: isTimeout ? "timeout" : "operation_failed" };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface RouteEvidence {
  id: string;
  compatible: boolean;
  healthy: boolean | null;
  latencyMs: number | null;
  errorRate: number | null;
  sampleCount: number;
  measuredAt: string | null;
}

export interface RouteRecommendation {
  decision: "recommendation" | "insufficient_data";
  candidates: Array<RouteEvidence & { score: number | null; confidence: "high" | "medium" | "low"; reasons: string[] }>;
  explanation: string;
}

export function rankRoutes(candidates: RouteEvidence[], now = new Date().toISOString()): RouteRecommendation {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("invalid_timestamp");
  const evaluated = candidates.slice(0, 50).map(candidate => {
    const reasons: string[] = [];
    const ageMs = candidate.measuredAt ? nowMs - Date.parse(candidate.measuredAt) : Infinity;
    const fresh = ageMs >= 0 && ageMs <= 15 * 60_000;
    const evidenceValid = Number.isInteger(candidate.sampleCount) && candidate.sampleCount >= 3 && candidate.healthy !== null && candidate.latencyMs !== null &&
      Number.isFinite(candidate.latencyMs) && candidate.latencyMs >= 0 &&
      candidate.errorRate !== null && Number.isFinite(candidate.errorRate) &&
      candidate.errorRate >= 0 && candidate.errorRate <= 1 && fresh;
    if (!candidate.compatible) reasons.push("incompatible");
    if (!fresh) reasons.push("health_or_latency_evidence_stale_or_missing");
    if (!Number.isInteger(candidate.sampleCount) || candidate.sampleCount < 3) reasons.push("minimum_three_samples_required");
    if (candidate.healthy === false) reasons.push("endpoint_unhealthy");
    if (candidate.latencyMs === null) reasons.push("latency_missing");
    if (candidate.errorRate === null) reasons.push("error_rate_missing");
    if (!evidenceValid || !candidate.compatible || candidate.healthy !== true) {
      return { ...candidate, score: null, confidence: "low" as const, reasons };
    }
    const latencyScore = 100 / (1 + candidate.latencyMs / 250);
    const score = Math.round((latencyScore * 0.55 + (1 - candidate.errorRate!) * 100 * 0.30 + 100 * 0.15) * 10) / 10;
    reasons.push("fresh_healthy_measurement", "latency_error_rate_and_availability_scored");
    const confidence = ageMs <= 5 * 60_000 ? "high" as const : "medium" as const;
    return { ...candidate, score, confidence, reasons };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));

  const usable = evaluated.filter(candidate => candidate.score !== null);
  if (usable.length === 0) return { decision: "insufficient_data", candidates: evaluated, explanation: "No compatible candidate has complete, fresh, healthy evidence. No route change was made." };
  return { decision: "recommendation", candidates: evaluated, explanation: "Advisory ranking only; settings and subscriptions are not modified." };
}
