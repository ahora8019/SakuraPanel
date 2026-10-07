export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    const current = this.hits.get(key);

    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: Math.max(0, limit - 1) };
    }

    if (current.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    current.count += 1;
    return { allowed: true, remaining: Math.max(0, limit - current.count) };
  }
}