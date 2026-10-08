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
  });

  it("contains the core tables required by the application", () => {
    const sql = readdirSync(migrationsDir)
      .filter(name => /^\d{4}_.+\.sql$/.test(name))
      .sort()
      .map(name => readFileSync(join(migrationsDir, name), "utf8"))
      .join("\n");

    for (const table of [
      "users", "devices", "endpoints", "endpoint_groups", "endpoint_group_members",
      "endpoint_health", "templates", "configs", "config_versions",
      "subscriptions", "subscription_versions", "audit_logs", "auth_sessions"
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}\\b`));
    }
  });

  it("contains the schema columns required by current repositories", () => {
    const configs = readFileSync(join(migrationsDir, "0007_configs.sql"), "utf8");
    const version = readFileSync(join(migrationsDir, "0011_config_template_version.sql"), "utf8");
    const users = readFileSync(join(migrationsDir, "0010_security.sql"), "utf8");

    for (const column of ["user_id", "device_id", "endpoint_id", "template_id", "status", "expires_at"]) {
      expect(configs).toContain(`  ${column} `);
    }
    expect(version).toContain("ADD COLUMN template_version");
    expect(users).toContain("ADD COLUMN security_version");
  });

  it("defines indexes for the repository hot paths", () => {
    const sql = readFileSync(join(migrationsDir, "0012_query_indexes.sql"), "utf8");
    for (const index of [
      "idx_configs_user_id", "idx_configs_endpoint_id", "idx_config_versions_config_id",
      "idx_subscriptions_user_id", "idx_subscription_versions_subscription_id"
    ]) {
      expect(sql).toContain(`CREATE INDEX ${index}`);
    }
  });
});
