import { describe, expect, it } from "vitest";
import { cleanupRateLimitBuckets } from "../src/security/rate-limit-cleanup";

describe("rate limit cleanup", () => {
  it("deletes expired buckets and returns the affected row count", async () => {
    let boundNow = 0;
    const db = {
      prepare: (sql: string) => {
        expect(sql).toBe("DELETE FROM rate_limit_buckets WHERE reset_at <= ?");
        return {
          bind: (now: number) => {
            boundNow = now;
            return {
              run: async () => ({ meta: { changes: 7 } })
            };
          }
        };
      }
    } as unknown as D1Database;

    await expect(cleanupRateLimitBuckets(db, 123456)).resolves.toBe(7);
    expect(boundNow).toBe(123456);
  });

  it("rejects invalid cleanup timestamps", async () => {
    const db = {} as D1Database;
    await expect(cleanupRateLimitBuckets(db, Number.NaN)).rejects.toThrow("invalid_cleanup_timestamp");
    await expect(cleanupRateLimitBuckets(db, -1)).rejects.toThrow("invalid_cleanup_timestamp");
  });
});
