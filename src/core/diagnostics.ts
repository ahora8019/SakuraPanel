import type { Env } from "../types/env";

const REQUIRED_TABLES = [
  "users",
  "devices",
  "templates",
  "configs",
  "config_versions",
  "config_releases",
  "subscriptions",
  "subscription_versions",
  "audit_logs",
  "auth_sessions",
  "rate_limit_buckets"
] as const;

export interface DiagnosticCheck {
  status: "ok" | "warning" | "error";
  detail?: string;
}

export interface DiagnosticsResult {
  ok: boolean;
  checks: {
    database: DiagnosticCheck;
    schema: DiagnosticCheck;
    foreignKeys: DiagnosticCheck;
    authentication: DiagnosticCheck;
    bootstrapAuthentication: DiagnosticCheck;
    emergencyLock: DiagnosticCheck;
  };
}

function securityConfiguration(env: Env) {
  return {
    authentication: typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32
      ? { status: "ok" as const }
      : { status: "error" as const, detail: "auth_secret_not_configured_or_too_short" },
    bootstrapAuthentication: typeof env.BOOTSTRAP_SECRET === "string" && env.BOOTSTRAP_SECRET.length >= 32
      ? { status: "ok" as const }
      : { status: "error" as const, detail: "bootstrap_secret_not_configured_or_too_short" },
    emergencyLock: env.SECURITY_KV
      ? { status: "ok" as const }
      : { status: "error" as const, detail: "security_kv_not_configured" }
  };
}

function securityConfigurationReady(checks: ReturnType<typeof securityConfiguration>): boolean {
  return checks.authentication.status === "ok" &&
    checks.bootstrapAuthentication.status === "ok" &&
    checks.emergencyLock.status === "ok";
}

export async function runDiagnostics(env: Env, _deep = true): Promise<DiagnosticsResult> {
  const security = securityConfiguration(env);
  if (!env.DB) {
    return {
      ok: false,
      checks: {
        database: { status: "error", detail: "database_not_configured" },
        schema: { status: "error", detail: "database_not_configured" },
        foreignKeys: { status: "warning", detail: "not_checked" },
        ...security
      }
    };
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all<{ name: string }>();

    const names = new Set((tables.results ?? []).map((row) => row.name));
    const missing = REQUIRED_TABLES.filter((name) => !names.has(name));
    const foreignKeys = await env.DB.prepare("PRAGMA foreign_key_check").all();

    const schema: DiagnosticCheck = missing.length === 0
      ? { status: "ok" }
      : { status: "error", detail: "missing_tables:" + missing.join(",") };

    const fk: DiagnosticCheck = (foreignKeys.results ?? []).length === 0
      ? { status: "ok" }
      : { status: "error", detail: "foreign_key_violations_detected" };

    return {
      ok: schema.status === "ok" && fk.status === "ok" && securityConfigurationReady(security),
      checks: {
        database: { status: "ok" },
        schema,
        foreignKeys: fk,
        ...security
      }
    };
  } catch {
    return {
      ok: false,
      checks: {
        database: { status: "error", detail: "database_check_failed" },
        schema: { status: "error", detail: "not_checked" },
        foreignKeys: { status: "warning", detail: "not_checked" },
        ...security
      }
    };
  }
}

export interface ReadinessResult {
  ok: boolean;
  database: DiagnosticCheck;
  authentication: DiagnosticCheck;
  bootstrapAuthentication: DiagnosticCheck;
  emergencyLock: DiagnosticCheck;
}

export async function runReadiness(env: Env): Promise<ReadinessResult> {
  const security = securityConfiguration(env);
  if (!env.DB) {
    return {
      ok: false,
      database: { status: "error", detail: "database_not_configured" },
      ...security
    };
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return {
      ok: securityConfigurationReady(security),
      database: { status: "ok" },
      ...security
    };
  } catch {
    return {
      ok: false,
      database: { status: "error", detail: "database_check_failed" },
      ...security
    };
  }
}
