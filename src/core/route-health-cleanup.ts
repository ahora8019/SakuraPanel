export async function cleanupRouteHealthSamples(
  db: D1Database,
  now = Date.now(),
  retentionDays = 7,
  batchSize = 1000
): Promise<number> {
  if (!Number.isFinite(now) || now < 0 ||
      !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90 ||
      !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("invalid_route_health_cleanup_options");
  }

  const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(
    "DELETE FROM route_health_samples WHERE id IN (SELECT id FROM route_health_samples WHERE measured_at < ? ORDER BY measured_at ASC LIMIT ?)"
  ).bind(cutoff, batchSize).run();

  return Number(result.meta.changes ?? 0);
}
