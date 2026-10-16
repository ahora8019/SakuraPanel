/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "migrations");

describe("D1 migration contract", () => {
  it("keeps migrations numerically ordered and uniquely numbered", () => {
    const files = readdirSync(migrationsDir).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
    const numbers = files.map(name => Number(name.slice(0, 4)));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers[0]).toBe(1);
    expect(numbers.at(-1)).toBe(24);
  });

  it("keeps member authentication after the existing production migration history", () => {
    const files = readdirSync(migrationsDir).filter(name => /^\d{4}_.+\.sql$/.test(name));
    expect(files).toContain("0023_member_auth.sql");
    expect(files).not.toContain("0011_member_auth.sql");
  });

  it("contains the core tables required by the application", () => {
    const sql = readdirSync(migrationsDir)
      .filter(name => /^\d{4}_.+\.sql$/.test(name))
      .sort()
      .map(name => readFileSync(join(migrationsDir, name), "utf8"))
      .join("\n");

    for (const table of [
      "users", "devices", "templates", "configs", "config_versions",
      "subscriptions", "subscription_versions", "audit_logs", "auth_sessions", "system_check_runs",
      "route_candidates", "route_health_samples", "operation_timing_samples", "member_invites"
    ]) {
      expect(sql).toMatch(new RegExp("CREATE TABLE(?: IF NOT EXISTS)? " + table + "\\b"));
    }

    expect(sql).toContain("DROP TABLE endpoint_health");
    expect(sql).toContain("DROP TABLE endpoint_group_members");
    expect(sql).toContain("DROP TABLE endpoint_groups");
    expect(sql).toContain("DROP TABLE endpoints");
  });

  it("removes endpoint_id from the current config schema", () => {
    const migration = readFileSync(join(migrationsDir, "0016_remove_endpoints.sql"), "utf8");
    expect(migration).not.toContain("endpoint_id TEXT");
    expect(migration).not.toContain("REFERENCES endpoints");
    expect(migration).toContain("CREATE TABLE configs_new");
  });

  it("defines indexes for current config and subscription hot paths", () => {
    const sql = readFileSync(join(migrationsDir, "0016_remove_endpoints.sql"), "utf8");
    for (const index of [
      "idx_configs_user_id", "idx_configs_template_id", "idx_configs_user_created_at",
      "idx_configs_device_created_at", "idx_config_versions_config_id",
      "idx_config_versions_config_version"
    ]) {
      expect(sql).toContain("CREATE INDEX " + index);
    }
  });
});
