import { describe, expect, it } from "vitest";
import { cleanupRouteHealthSamples } from "../src/core/route-health-cleanup";

describe("Route Advisor evidence retention", () => {
  it("deletes only a bounded batch of samples older than the retention cutoff", async () => {
    let sql = "";
    let bindings: unknown[] = [];
    const db = {
      prepare(statement: string) {
        sql = statement;
        return {
          bind(...values: unknown[]) {
            bindings = values;
            return { run: async () => ({ meta: { changes: 17 } }) };
          }
        };
      }
    } as unknown as D1Database;

    await expect(cleanupRouteHealthSamples(db, Date.parse("2026-10-09T12:00:00.000Z"), 7, 250)).resolves.toBe(17);
    expect(sql).toContain("measured_at < ?");
    expect(sql).toContain("ORDER BY measured_at ASC LIMIT ?");
    expect(bindings[0]).toBe("2026-10-02T12:00:00.000Z");
    expect(bindings[1]).toBe(250);
  });

  it("rejects invalid retention and batch limits", async () => {
    const db = {} as D1Database;
    await expect(cleanupRouteHealthSamples(db, Number.NaN)).rejects.toThrow("invalid_route_health_cleanup_options");
    await expect(cleanupRouteHealthSamples(db, 1000, 0, 10)).rejects.toThrow("invalid_route_health_cleanup_options");
    await expect(cleanupRouteHealthSamples(db, 1000, 7, 5001)).rejects.toThrow("invalid_route_health_cleanup_options");
  });
});
