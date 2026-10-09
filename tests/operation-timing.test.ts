import { describe, expect, it } from "vitest";
import { cleanupOperationTimingSamples, recordOperationTiming } from "../src/core/operation-timing";

describe("non-sensitive operation timing telemetry", () => {
  it("persists operation, timestamp and duration without a user or payload field", async () => {
    let sql = "";
    let values: unknown[] = [];
    const db = {
      prepare(statement: string) {
        sql = statement;
        return {
          bind(...bound: unknown[]) {
            values = bound;
            return { run: async () => ({ success: true }) };
          }
        };
      }
    } as unknown as D1Database;

    await expect(recordOperationTiming(db, "config_generate", 12.34, "2026-10-09T12:00:00.000Z")).resolves.toBe(true);
    expect(sql).toContain("INSERT INTO operation_timing_samples");
    expect(values[1]).toBe("config_generate");
    expect(values[2]).toBe("2026-10-09T12:00:00.000Z");
    expect(values[3]).toBe(12.34);
    expect(values).toHaveLength(4);
  });

  it("does not break a successful request when telemetry storage fails", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return { run: async () => { throw new Error("database unavailable"); } };
          }
        };
      }
    } as unknown as D1Database;
    await expect(recordOperationTiming(db, "subscription_provision", 8)).resolves.toBe(false);
  });

  it("cleans up only a bounded batch of old timing samples", async () => {
    let values: unknown[] = [];
    const db = {
      prepare: (sql: string) => {
        expect(sql).toContain("DELETE FROM operation_timing_samples");
        expect(sql).toContain("LIMIT ?");
        return {
          bind(...bound: unknown[]) {
            values = bound;
            return { run: async () => ({ meta: { changes: 5 } }) };
          }
        };
      }
    } as unknown as D1Database;
    await expect(cleanupOperationTimingSamples(db, Date.parse("2026-10-09T12:00:00.000Z"), 7, 100)).resolves.toBe(5);
    expect(values).toEqual(["2026-10-02T12:00:00.000Z", 100]);
  });
});
