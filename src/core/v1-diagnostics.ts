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
  devices: ["id", "user_id", "status", "created_at"],
  templates: ["id", "name", "protocol", "definition_json", "status"],
  configs: ["id", "user_id", "template_id", "template_version", "status", "expires_at", "published_version"],
  config_versions: ["id", "config_id", "version", "payload"],
  config_releases: ["id", "config_id", "version", "status", "actor_id", "created_at"],
  subscriptions: ["id", "user_id", "status", "expires_at"],
  subscription_versions: ["id", "subscription_id", "version", "config_ids_json"],
  auth_sessions: ["id", "user_id", "token_version", "expires_at", "revoked_at"],
  audit_logs: ["id", "actor_id", "action", "resource", "created_at"],
  rate_limit_buckets: ["key", "reset_at", "count"],
  system_check_runs: ["id", "scheduled_slot", "status", "started_at", "completed_at", "duration_ms", "result_json"]
};

const REQUIRED_INDEXES = [
  "idx_users_single_owner", "idx_devices_user_id", "idx_devices_user_status_created_at",
  "idx_configs_user_id", "idx_configs_template_id", "idx_configs_user_created_at",
  "idx_configs_device_created_at", "idx_config_versions_config_id", "idx_config_versions_config_version",
  "idx_config_releases_config_created_at", "idx_config_releases_status",
  "idx_subscriptions_user_id", "idx_subscriptions_user_created_at",
  "idx_subscription_versions_subscription_id", "idx_subscription_versions_created_at",
  "idx_subscription_versions_subscription_version",
  "idx_audit_logs_actor_id", "idx_audit_logs_created_at", "idx_audit_logs_resource",
  "idx_audit_logs_actor_created_at", "idx_audit_logs_resource_created_at",
  "idx_auth_sessions_user_id", "idx_auth_sessions_expires_at", "idx_rate_limit_buckets_reset_at",
  "idx_system_check_runs_started_at", "idx_system_check_runs_status_started_at"
] as const;

const FORBIDDEN_LEGACY_TABLES = ["endpoints", "endpoint_health"] as const;

const REQUIRED_FOREIGN_KEYS: Record<string, Array<{ from: string; table: string; to: string }>> = {
  devices: [{ from: "user_id", table: "users", to: "id" }],
  configs: [
    { from: "user_id", table: "users", to: "id" },
    { from: "device_id", table: "devices", to: "id" },
    { from: "template_id", table: "templates", to: "id" }
  ],
  config_versions: [{ from: "config_id", table: "configs", to: "id" }],
  config_releases: [{ from: "config_id", table: "configs", to: "id" }],
  subscriptions: [{ from: "user_id", table: "users", to: "id" }],
  subscription_versions: [{ from: "subscription_id", table: "subscriptions", to: "id" }],
  auth_sessions: [{ from: "user_id", table: "users", to: "id" }]
};

export async function runPulse(env: Env): Promise<PulseReport> {
  const started = performance.now();
  const measuredAt = new Date().toISOString();
  const checks: PulseCheck[] = [];

  const authConfigured = typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32;
  checks.push({
    name: "authentication_configuration",
    status: authConfigured ? "passed" : "failed",
    durationMs: 0,
    ...(!authConfigured ? { detail: "auth_secret_missing_or_too_short" } : {})
  });

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
      const ownerCheck = await timeBounded(async () => {
        const row = await env.DB!.prepare("SELECT COUNT(*) AS count FROM users WHERE role='OWNER' AND status='ACTIVE'").first<{ count: number }>();
        return Number(row?.count ?? 0);
      });
      checks.push({
        name: "active_owner_setup",
        status: !ownerCheck.ok ? (ownerCheck.error === "timeout" ? "unavailable" : "failed") : ownerCheck.value! > 0 ? "passed" : "failed",
        durationMs: ownerCheck.durationMs,
        ...(!ownerCheck.ok ? { detail: ownerCheck.error === "timeout" ? "owner_check_timeout" : "owner_check_failed" } :
          ownerCheck.value! === 0 ? { detail: "no_active_owner_configured" } : {})
      });

      const schemaResult = await timeBounded(async () => {
        const tables = await env.DB!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
        const names = new Set((tables.results ?? []).map(row => row.name));
        const missingTables = Object.keys(REQUIRED_COLUMNS).filter(name => !names.has(name));
        const unexpectedLegacyTables = FORBIDDEN_LEGACY_TABLES.filter(name => names.has(name));
        const missingColumns: string[] = [];
        for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
          if (!names.has(table)) continue;
          const rows = await env.DB!.prepare("PRAGMA table_info(" + table + ")").all<{ name: string }>();
          const actual = new Set((rows.results ?? []).map(row => row.name));
          for (const column of columns) if (!actual.has(column)) missingColumns.push(table + "." + column);
        }
        const indexes = await env.DB!.prepare("SELECT name FROM sqlite_master WHERE type='index'").all<{ name: string }>();
        const indexNames = new Set((indexes.results ?? []).map(row => row.name));
        const missingIndexes = REQUIRED_INDEXES.filter(name => !indexNames.has(name));
        const missingForeignKeys: string[] = [];
        for (const [table, requiredKeys] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
          if (!names.has(table)) continue;
          const rows = await env.DB!.prepare("PRAGMA foreign_key_list(" + table + ")").all<{ from: string; table: string; to: string }>();
          const actual = new Set((rows.results ?? []).map(row => row.from + "->" + row.table + "." + row.to));
          for (const key of requiredKeys) {
            const signature = key.from + "->" + key.table + "." + key.to;
            if (!actual.has(signature)) missingForeignKeys.push(table + "." + signature);
          }
        }
        return { missingTables, missingColumns, missingIndexes, missingForeignKeys, unexpectedLegacyTables };
      });
      const schemaOkay = schemaResult.ok && schemaResult.value!.missingTables.length === 0 && schemaResult.value!.missingColumns.length === 0 && schemaResult.value!.missingIndexes.length === 0 && schemaResult.value!.missingForeignKeys.length === 0 && schemaResult.value!.unexpectedLegacyTables.length === 0;
      checks.push({
        name: "database_schema",
        status: !schemaResult.ok ? (schemaResult.error === "timeout" ? "unavailable" : "failed") : schemaOkay ? "passed" : "failed",
        durationMs: schemaResult.durationMs,
        ...(!schemaResult.ok ? { detail: schemaResult.error === "timeout" ? "schema_check_timeout" : "schema_check_failed" } :
          !schemaOkay ? { detail: [
            ...(schemaResult.value!.missingTables.length ? ["missing_tables:" + schemaResult.value!.missingTables.join(",")] : []),
            ...(schemaResult.value!.missingColumns.length ? ["missing_columns:" + schemaResult.value!.missingColumns.join(",")] : []),
            ...(schemaResult.value!.missingIndexes.length ? ["missing_indexes:" + schemaResult.value!.missingIndexes.join(",")] : []),
            ...(schemaResult.value!.missingForeignKeys.length ? ["missing_foreign_keys:" + schemaResult.value!.missingForeignKeys.join(",")] : []),
            ...(schemaResult.value!.unexpectedLegacyTables.length ? ["unexpected_legacy_tables:" + schemaResult.value!.unexpectedLegacyTables.join(",")] : [])
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
