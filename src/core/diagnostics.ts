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
  };
}

export async function runDiagnostics(env: Env, deep = true): Promise<DiagnosticsResult> {
  if (!env.DB) {
    return {
      ok: false,
      checks: {
        database: { status: "error", detail: "database_not_configured" },
        schema: { status: "error", detail: "database_not_configured" },
        foreignKeys: { status: "warning", detail: "not_checked" }
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
      ok: schema.status === "ok" && fk.status === "ok",
      checks: {
        database: { status: "ok" },
        schema,
        foreignKeys: fk
      }
    };
  } catch {
    return {
      ok: false,
      checks: {
        database: { status: "error", detail: "database_check_failed" },
        schema: { status: "error", detail: "not_checked" },
        foreignKeys: { status: "warning", detail: "not_checked" }
      }
    };
  }
}

export interface ReadinessResult {
  ok: boolean;
  database: DiagnosticCheck;
}

export async function runReadiness(env: Env): Promise<ReadinessResult> {
  if (!env.DB) {
    return {
      ok: false,
      database: { status: "error", detail: "database_not_configured" }
    };
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return {
      ok: true,
      database: { status: "ok" }
    };
  } catch {
    return {
      ok: false,
      database: { status: "error", detail: "database_check_failed" }
    };
  }
}
