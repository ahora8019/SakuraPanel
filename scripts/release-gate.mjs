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
  const ordered = nums.every((num, index) => num === index + 1);
  check("migration_order", files.length > 0 && unique && ordered, `${files.length} migration files found; filenames are unique and ordered`);
} catch {
  check("migration_order", false, "migration directory is unavailable");
}

for (const path of [
  "tests/readiness.test.ts",
  "tests/security.test.ts",
  "tests/user-authorization.test.ts",
  "tests/v1-systems.test.ts",
  "tests/v1-systems-api.test.ts",
  "tests/config-studio-malformed.test.ts",
  "tests/scheduled-pulse.test.ts"
]) {
  check("required_test:" + path, existsSync(path), existsSync(path) ? "test file exists; test execution is a separate gate" : "required regression test file is missing");
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
