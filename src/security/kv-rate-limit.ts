import type { RateLimitDecision } from "./rate-limit";

interface Bucket { count: number; resetAt: number; }

export class KvRateLimiter {
  constructor(private readonly kv: KVNamespace) {}

  async check(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitDecision> {
    if (!key || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("invalid_rate_limit_parameters");
    }

    const storageKey = `rl:${key}`;
    const current = await this.kv.get<Bucket>(storageKey, "json");
    if (!current || current.resetAt <= now) {
      await this.kv.put(storageKey, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
        expirationTtl: Math.max(1, Math.ceil(windowMs / 1000))
      });
      return { allowed: true, remaining: Math.max(0, limit - 1) };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    await this.kv.put(storageKey, JSON.stringify({ count: current.count + 1, resetAt: current.resetAt }), {
      expirationTtl: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    });

    return { allowed: true, remaining: Math.max(0, limit - current.count - 1) };
  }
}
