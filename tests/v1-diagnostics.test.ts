import { describe, expect, it } from "vitest";
import type { Env } from "../src/types/env";
import { runPulse } from "../src/core/v1-diagnostics";

const columns: Record<string, string[]> = {
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
  rate_limit_buckets: ["key", "reset_at", "count"]
};
const indexes = [
  "idx_users_single_owner", "idx_devices_user_id", "idx_devices_user_status_created_at", "idx_configs_user_id",
  "idx_configs_template_id", "idx_configs_user_created_at", "idx_configs_device_created_at",
  "idx_config_versions_config_id", "idx_config_versions_config_version", "idx_config_releases_config_created_at",
  "idx_config_releases_status", "idx_subscriptions_user_id", "idx_subscriptions_user_created_at",
  "idx_subscription_versions_subscription_id", "idx_subscription_versions_created_at",
  "idx_subscription_versions_subscription_version", "idx_audit_logs_actor_id", "idx_audit_logs_created_at",
  "idx_audit_logs_resource", "idx_audit_logs_actor_created_at", "idx_audit_logs_resource_created_at",
  "idx_auth_sessions_user_id", "idx_auth_sessions_expires_at", "idx_rate_limit_buckets_reset_at"
];

const foreignKeys: Record<string, Array<{ from: string; table: string; to: string }>> = {
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
function fakeDb(options: { missingColumn?: string; queryFailure?: boolean; foreignKeyViolation?: boolean; missingForeignKey?: string } = {}): D1Database {
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (options.queryFailure && sql.includes("SELECT 1")) throw new Error("database unavailable");
          if (sql.includes("SELECT 1")) return { ok: 1 };
          if (sql.includes("COUNT(*) AS count")) return { count: 1 };
          return null;
        },
        async all() {
          if (options.queryFailure) throw new Error("database unavailable");
          if (sql.includes("sqlite_master") && sql.includes("type='table'")) {
            return { results: Object.keys(columns).map(name => ({ name })) };
          }
          if (sql.includes("PRAGMA table_info(")) {
            const table = sql.match(/PRAGMA table_info\(([^)]+)\)/)?.[1] ?? "";
            return { results: (columns[table] ?? []).filter(name => table + "." + name !== options.missingColumn).map(name => ({ name })) };
          }
          if (sql.includes("sqlite_master") && sql.includes("type='index'")) return { results: indexes.map(name => ({ name })) };
          if (sql.includes("PRAGMA foreign_key_check")) return { results: options.foreignKeyViolation ? [{ table: "configs" }] : [] };
          if (sql.includes("PRAGMA foreign_key_list(")) {
            const table = sql.match(/PRAGMA foreign_key_list\\(([^)]+)\\)/)?.[1] ?? "";
            return { results: (foreignKeys[table] ?? []).filter(key => table + "." + key.from + "->" + key.table + "." + key.to !== options.missingForeignKey) };
          }
          return { results: [] };
        }
      };
    }
  };
  return db as unknown as D1Database;
}

function fakeKv(locked = false): KVNamespace {
  return { get: async () => locked ? "1" : null } as unknown as KVNamespace;
}
function env(options: { db?: D1Database; kv?: KVNamespace; authSecret?: string } = {}): Env {
  return {
    AUTH_SECRET: options.authSecret ?? "a".repeat(48),
    DB: options.db,
    SECURITY_KV: options.kv
  };
}

describe("Sakura Pulse", () => {
  it("reports passed only when real database/schema/FK and lock checks pass", async () => {
    const report = await runPulse(env({ db: fakeDb(), kv: fakeKv() }));
    expect(report.status).toBe("passed");
    expect(report.checks.every(check => check.status === "passed")).toBe(true);
  });

  it("fails schema health when a required column is missing", async () => {
    const report = await runPulse(env({ db: fakeDb({ missingColumn: "configs.published_version" }), kv: fakeKv() }));
    expect(report.status).toBe("failed");
    expect(report.checks.find(check => check.name === "database_schema")?.status).toBe("failed");
  });

  it("fails schema health when a required foreign-key constraint is missing", async () => {
    const report = await runPulse(env({ db: fakeDb({ missingForeignKey: "configs.template_id->templates.id" }), kv: fakeKv() }));
    expect(report.status).toBe("failed");
    expect(report.checks.find(check => check.name === "database_schema")?.detail).toContain("missing_foreign_keys");
  });

  it("fails when foreign-key violations are detected", async () => {
    const report = await runPulse(env({ db: fakeDb({ foreignKeyViolation: true }), kv: fakeKv() }));
    expect(report.status).toBe("failed");
    expect(report.checks.find(check => check.name === "foreign_key_integrity")?.status).toBe("failed");
  });

  it("distinguishes unavailable dependencies and active Emergency Lock", async () => {
    const missing = await runPulse(env());
    expect(missing.status).toBe("unavailable");
    expect(missing.checks.some(check => check.status === "skipped")).toBe(true);
    const locked = await runPulse(env({ db: fakeDb(), kv: fakeKv(true) }));
    expect(locked.status).toBe("failed");
    expect(locked.checks.find(check => check.name === "emergency_lock_control")?.detail).toBe("emergency_lock_active");
  });

  it("does not expose the authentication secret in diagnostic output", async () => {
    const secret = "private-auth-secret-should-never-be-returned";
    const report = await runPulse(env({ db: fakeDb(), kv: fakeKv(), authSecret: secret }));
    expect(JSON.stringify(report)).not.toContain(secret);
  });
});
