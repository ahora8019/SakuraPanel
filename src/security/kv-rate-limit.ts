import type { RateLimitDecision } from "./rate-limit";

interface Bucket { count: number; resetAt: number; }

export class KvRateLimiter {
  constructor(private readonly db: D1Database) {}

  async check(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitDecision> {
    if (!key || key.length > 256 || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("invalid_rate_limit_parameters");
    }

    const resetAt = now + windowMs;
    // The upsert is a single SQLite statement, so concurrent requests cannot lose
    // increments between a read and a write. KV's eventual consistency made that
    // pattern unsafe for an authentication limiter.
    const row = await this.db.prepare(`
      INSERT INTO rate_limit_buckets (key, count, reset_at)
      VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
      RETURNING count, reset_at
    `).bind(key, resetAt, now, now, resetAt).first<Bucket>();

    if (!row) throw new Error("rate_limit_store_unavailable");

    if (row.count >= limit) {
      if (row.count > limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt - now) / 1000))
        };
      }
      return {
        allowed: true,
        remaining: 0
      };
    }

    return { allowed: true, remaining: Math.max(0, limit - row.count) };
  }
}
