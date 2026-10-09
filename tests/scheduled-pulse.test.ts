import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/core/v1-diagnostics", () => ({
  runPulse: vi.fn(async () => ({
    status: "passed",
    measuredAt: "2026-10-09T12:00:00.000Z",
    durationMs: 12,
    checks: [{ name: "database_connectivity", status: "passed", durationMs: 1 }]
  }))
}));

import { runScheduledPulse } from "../src/core/scheduled-pulse";

function fakeDb(options: { active?: boolean; duplicate?: boolean; fail?: boolean } = {}) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const state = { args: [] as unknown[] };
      return {
        bind(...args: unknown[]) { state.args = args; return this; },
        async first() {
          if (options.fail) throw new Error("private database failure");
          if (sql.includes("SELECT id FROM system_check_runs WHERE status='running'")) {
            return options.active ? { id: "existing-run" } : null;
          }
          return null;
        },
        async run() {
          if (options.fail) throw new Error("private database failure");
          calls.push({ sql, args: state.args });
          if (sql.includes("INSERT INTO system_check_runs")) return { meta: { changes: options.duplicate ? 0 : 1 } };
          return { meta: { changes: 1 } };
        }
      };
    }
  };
  return { db: db as unknown as D1Database, calls };
}

describe("scheduled Sakura Pulse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a successful bounded hourly run and retention cleanup", async () => {
    const { db, calls } = fakeDb();
    const outcome = await runScheduledPulse({ DB: db, AUTH_SECRET: "a".repeat(40), SECURITY_KV: {} as KVNamespace } as Env, Date.parse("2026-10-09T12:00:00.000Z"));
    expect(outcome.status).toBe("passed");
    expect(outcome.scheduledSlot).toBe("2026-10-09T12:00:00Z");
    expect(calls.some(call => call.sql.includes("INSERT INTO system_check_runs"))).toBe(true);
    expect(calls.some(call => call.sql.includes("UPDATE system_check_runs SET status=?"))).toBe(true);
    expect(calls.some(call => call.sql.includes("OFFSET 1000"))).toBe(true);
  });

  it("prevents a second overlapping run", async () => {
    const { db, calls } = fakeDb({ active: true });
    const outcome = await runScheduledPulse({ DB: db } as Env, Date.parse("2026-10-09T13:00:00.000Z"));
    expect(outcome.status).toBe("running");
    expect(outcome.reason).toBe("another_run_in_progress");
    expect(calls.some(call => call.sql.includes("INSERT INTO system_check_runs"))).toBe(false);
  });

  it("does not duplicate a scheduled slot", async () => {
    const { db, calls } = fakeDb({ duplicate: true });
    const outcome = await runScheduledPulse({ DB: db } as Env, Date.parse("2026-10-09T12:00:00.000Z"));
    expect(outcome.status).toBe("running");
    expect(outcome.reason).toBe("duplicate_slot");
    expect(calls.some(call => call.sql.includes("UPDATE system_check_runs SET status=?"))).toBe(false);
  });

  it("reports unavailable when D1 is not configured", async () => {
    expect(await runScheduledPulse({} as Env)).toEqual({ status: "unavailable", reason: "database_binding_missing" });
  });

  it("does not expose storage exception details", async () => {
    const { db } = fakeDb({ fail: true });
    const outcome = await runScheduledPulse({ DB: db } as Env);
    expect(outcome.status).toBe("unavailable");
    expect(JSON.stringify(outcome)).not.toContain("private database failure");
  });
});
