import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const checks = [];
const check = (name, passed, detail) => checks.push({ name, status: passed ? "PASS" : "FAIL", detail });
const read = path => readFileSync(path, "utf8");

try {
  const pkg = JSON.parse(read("package.json"));
  check("package_scripts", Boolean(pkg.scripts?.typecheck && pkg.scripts?.test), "typecheck and test scripts are declared");
} catch {
  check("package_scripts", false, "package.json is missing or invalid JSON");
}

try {
  const config = JSON.parse(read("wrangler.jsonc"));
  const db = Array.isArray(config.d1_databases) && config.d1_databases.some(binding => binding.binding === "DB" && binding.database_id);
  const kv = Array.isArray(config.kv_namespaces) && config.kv_namespaces.some(binding => binding.binding === "SECURITY_KV" && binding.id);
  check("cloudflare_bindings", db && kv, "DB and SECURITY_KV bindings must be present in the deployment config");
  check("migration_directory", config.d1_databases.some(binding => binding.binding === "DB" && binding.migrations_dir === "migrations"), "D1 migrations directory is configured");
} catch {
  check("cloudflare_config", false, "wrangler.jsonc is missing or invalid JSON/JSONC without comments");
}

try {
  const env = read("src/types/env.ts");
  const hasRequiredEnv = /AUTH_SECRET\s*:\s*string/.test(env) && /BOOTSTRAP_SECRET\??\s*:\s*string/.test(env) &&
    /DB\??\s*:\s*D1Database/.test(env) && /SECURITY_KV\??\s*:\s*KVNamespace/.test(env);
  check("runtime_environment_contract", hasRequiredEnv, "AUTH_SECRET, BOOTSTRAP_SECRET, DB and SECURITY_KV are declared");
} catch {
  check("runtime_environment_contract", false, "runtime environment type is unavailable");
}

try {
  const files = readdirSync("migrations").filter(file => /^\d{4}_.+\.sql$/.test(file)).sort();
  const nums = files.map(file => Number(file.slice(0, 4)));
  const unique = new Set(nums).size === nums.length;
  const ordered = nums.every((num, index) => index === 0 || num > nums[index - 1]);
  const contiguous = nums.every((num, index) => num === index + 1);
  const memberAuthVersionSafe = files.includes("0023_member_auth.sql") && !files.includes("0011_member_auth.sql");
  check("migration_order", files.length > 0 && unique && ordered && contiguous && memberAuthVersionSafe, `${files.length} migration files found; versions must be unique, increasing, contiguous from 0001, and member auth must be appended after the existing release history`);
} catch {
  check("migration_order", false, "migration directory is unavailable");
}

for (const path of [
  "tests/schema-integrity.test.ts",
  "tests/readiness.test.ts",
  "tests/security.test.ts",
  "tests/user-authorization.test.ts",
  "tests/v1-systems.test.ts",
  "tests/v1-systems-api.test.ts",
  "tests/config-studio-malformed.test.ts",
  "tests/scheduled-pulse.test.ts",
  "tests/server-timing.test.ts",
  "tests/route-health-cleanup.test.ts",
  "tests/operation-timing.test.ts"
]) {
  check("required_test:" + path, existsSync(path), existsSync(path) ? "test file exists; test execution is a separate gate" : "required regression test file is missing");
}

for (const [name, path, pattern, detail] of [
  ["production_environment_gate", ".github/workflows/deploy.yml", /environment:\s*production/, "Production deployment uses the production environment gate"],
  ["production_main_branch_only", ".github/workflows/deploy.yml", /github\.ref\s*!=\s*['"]refs\/heads\/main['"]/, "Production deployment is restricted to main"],
  ["config_generation_server_timing", "src/api/config-api.ts", /Server-Timing.*config_generate/, "real config generation reports server-side duration"],
  ["subscription_provision_server_timing", "src/api/subscription-api.ts", /Server-Timing.*subscription_provision/, "real subscription provisioning reports server-side duration"],
  ["route_candidate_schema", "migrations/0020_route_candidates.sql", /CREATE TABLE route_candidates/, "Route Advisor has a dedicated candidate model"],
  ["route_health_sample_schema", "migrations/0021_route_health_samples.sql", /CREATE TABLE route_health_samples/, "Route Advisor has a persisted health evidence model"],
  ["route_health_retention", "src/core/route-health-cleanup.ts", /LIMIT \?/, "Route Advisor evidence retention deletes a bounded batch"],
  ["operation_timing_schema", "migrations/0022_operation_timing_samples.sql", /CREATE TABLE operation_timing_samples/, "real operation timings have a dedicated history table"],
  ["operation_timing_retention", "src/core/operation-timing.ts", /LIMIT \?/, "operation timing history uses bounded retention"],
  ["speed_history_query", "src/api/v1-systems-api.ts", /operation_timing_samples.*LIMIT 100/s, "Speed Lab history query is bounded to 100 rows"]
]) {
  try {
    check(name, pattern.test(read(path)), detail);
  } catch {
    check(name, false, path + " is unavailable");
  }
}

const blockers = checks.filter(item => item.status !== "PASS");
const report = {
  revision: process.env.GITHUB_SHA || "local-or-unknown",
  evaluatedAt: new Date().toISOString(),
  decision: blockers.length ? "BLOCKED" : "PREFLIGHT_PASS",
  checks,
  blockers: blockers.map(item => ({ name: item.name, detail: item.detail })),
  note: "Preflight does not prove CI, live Cloudflare health, isolated restore, or Production deployment."
};
const output = JSON.stringify(report, null, 2);
console.log(output);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## Safe Release Lab preflight\n\nDecision: **${report.decision}**\n\n| Check | Status | Detail |\n|---|---|---|\n` +
    checks.map(item => `| ${item.name} | ${item.status} | ${item.detail.replaceAll("|", "\\|")} |`).join("\n") +
    `\n\nRevision: \`${report.revision}\`\n\n${report.note}\n`);
}
if (blockers.length) process.exitCode = 1;
