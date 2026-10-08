export async function cleanupRateLimitBuckets(db: D1Database, now = Date.now()): Promise<number> {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error("invalid_cleanup_timestamp");
  }

  const result = await db
    .prepare("DELETE FROM rate_limit_buckets WHERE reset_at <= ?")
    .bind(now)
    .run();

  return Number(result.meta.changes ?? 0);
}
