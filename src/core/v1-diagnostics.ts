import type { Env } from "../types/env";
import { EmergencyLock } from "../security/emergency-lock";
import { timeBounded } from "./v1-systems";

export type PulseStatus = "passed" | "failed" | "unavailable" | "skipped";
export interface PulseCheck {
  name: string;
  status: PulseStatus;
  durationMs: number | null;
  detail?: string;
}
export interface PulseReport {
  status: "passed" | "failed" | "unavailable";
  measuredAt: string;
  durationMs: number;
  checks: PulseCheck[];
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  users: ["id", "username", "role", "status", "security_version"],
  configs: ["id", "user_id", "template_id", "template_version", "status", "expires_at"],
  config_versions: ["id", "config_id", "version", "payload"],
  templates: ["id", "name", "protocol", "definition", "status"],
  auth_sessions: ["id", "user_id", "token_version", "expires_at", "revoked_at"],
  audit_logs: ["id", "actor_user_id", "action", "created_at"],
  rate_limit_buckets: ["bucket_key", "window_started_at", "count"]
};

export async function runPulse(env: Env): Promise<PulseReport> {
  const started = performance.now();
  const measuredAt = new Date().toISOString();
  const checks: PulseCheck[] = [];

  if (!env.DB) {
    checks.push({ name: "database_connectivity", status: "unavailable", durationMs: null, detail: "database_binding_missing" });
    checks.push({ name: "database_schema", status: "skipped", durationMs: null, detail: "database_binding_missing" });
    checks.push({ name: "foreign_key_integrity", status: "skipped", durationMs: null, detail: "database_binding_missing" });
  } else {
    const connectivity = await timeBounded(async () => {
      await env.DB!.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return true;
    });
    checks.push({
      name: "database_connectivity",
      status: connectivity.ok ? "passed" : connectivity.error === "timeout" ? "unavailable" : "failed",
      durationMs: connectivity.durationMs,
      ...(connectivity.ok ? {} : { detail: connectivity.error === "timeout" ? "database_query_timeout" : "database_query_failed" })
    });

    if (connectivity.ok) {
      const schemaResult = await timeBounded(async () => {
        const tables = await env.DB!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
        const names = new Set((tables.results ?? []).map(row => row.name));
        const missingTables = Object.keys(REQUIRED_COLUMNS).filter(name => !names.has(name));
        const missingColumns: string[] = [];
        for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
          if (!names.has(table)) continue;
          const rows = await env.DB!.prepare("PRAGMA table_info(" + table + ")").all<{ name: string }>();
          const actual = new Set((rows.results ?? []).map(row => row.name));
          for (const column of columns) if (!actual.has(column)) missingColumns.push(table + "." + column);
        }
        return { missingTables, missingColumns };
      });
      const schemaOkay = schemaResult.ok && schemaResult.value!.missingTables.length === 0 && schemaResult.value!.missingColumns.length === 0;
      checks.push({
        name: "database_schema",
        status: !schemaResult.ok ? (schemaResult.error === "timeout" ? "unavailable" : "failed") : schemaOkay ? "passed" : "failed",
        durationMs: schemaResult.durationMs,
        ...(!schemaResult.ok ? { detail: schemaResult.error === "timeout" ? "schema_check_timeout" : "schema_check_failed" } :
          !schemaOkay ? { detail: [
            ...(schemaResult.value!.missingTables.length ? ["missing_tables:" + schemaResult.value!.missingTables.join(",")] : []),
            ...(schemaResult.value!.missingColumns.length ? ["missing_columns:" + schemaResult.value!.missingColumns.join(",")] : [])
          ].join(";") } : {})
      });

      const fk = await timeBounded(async () => {
        const result = await env.DB!.prepare("PRAGMA foreign_key_check").all();
        return (result.results ?? []).length;
      });
      checks.push({
        name: "foreign_key_integrity",
        status: !fk.ok ? (fk.error === "timeout" ? "unavailable" : "failed") : fk.value === 0 ? "passed" : "failed",
        durationMs: fk.durationMs,
        ...(!fk.ok ? { detail: fk.error === "timeout" ? "foreign_key_check_timeout" : "foreign_key_check_failed" } :
          fk.value !== 0 ? { detail: "foreign_key_violations_detected" } : {})
      });
    } else {
      checks.push({ name: "database_schema", status: "skipped", durationMs: null, detail: "connectivity_check_failed" });
      checks.push({ name: "foreign_key_integrity", status: "skipped", durationMs: null, detail: "connectivity_check_failed" });
    }
  }

  if (!env.SECURITY_KV) {
    checks.push({ name: "emergency_lock_control", status: "unavailable", durationMs: null, detail: "security_control_binding_missing" });
  } else {
    const lockCheck = await timeBounded(async () => new EmergencyLock(env.SECURITY_KV!).isLocked());
    checks.push({
      name: "emergency_lock_control",
      status: !lockCheck.ok ? "unavailable" : lockCheck.value ? "failed" : "passed",
      durationMs: lockCheck.durationMs,
      ...(!lockCheck.ok ? { detail: "security_control_check_failed" } :
        lockCheck.value ? { detail: "emergency_lock_active" } : {})
    });
  }

  const hasFailure = checks.some(check => check.status === "failed");
  const unavailable = checks.some(check => check.status === "unavailable" || check.status === "skipped");
  return {
    status: hasFailure ? "failed" : unavailable ? "unavailable" : "passed",
    measuredAt,
    durationMs: Math.max(0, performance.now() - started),
    checks
  };
}
