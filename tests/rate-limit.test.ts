import { describe, expect, it } from "vitest";
import { KvRateLimiter } from "../src/security/kv-rate-limit";

describe("D1-backed rate limiter", () => {
  it("accepts up to the limit and rejects the next request", async () => {
    let count = 0;
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ count: ++count, resetAt: 11000 })
        })
      })
    } as unknown as D1Database;

    const limiter = new KvRateLimiter(db);
    expect((await limiter.check("ip:1", 2, 10000, 1000)).allowed).toBe(true);
    expect((await limiter.check("ip:1", 2, 10000, 1000)).allowed).toBe(true);
    const blocked = await limiter.check("ip:1", 2, 10000, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);
  });

  it("rejects invalid keys and limits", async () => {
    const db = {} as D1Database;
    const limiter = new KvRateLimiter(db);
    await expect(limiter.check("", 2, 1000)).rejects.toThrow("invalid_rate_limit_parameters");
    await expect(limiter.check("x", 0, 1000)).rejects.toThrow("invalid_rate_limit_parameters");
  });
});
