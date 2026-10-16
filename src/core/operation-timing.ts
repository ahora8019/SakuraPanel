export type TimedOperation = "config_generate" | "subscription_provision";

export async function recordOperationTiming(
  db: D1Database | undefined,
  operation: TimedOperation,
  durationMs: number,
  measuredAt = new Date().toISOString()
): Promise<boolean> {
  if (!db || !Number.isFinite(durationMs) || durationMs < 0 || !Number.isFinite(Date.parse(measuredAt))) {
    return false;
  }

  try {
    await db.prepare(
      "INSERT INTO operation_timing_samples (id, operation, measured_at, duration_ms) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), operation, measuredAt, durationMs).run();
    return true;
  } catch {
    // Telemetry is best-effort and must never break a successful config/subscription operation.
    return false;
  }
}

export async function cleanupOperationTimingSamples(
  db: D1Database,
  now = Date.now(),
  retentionDays = 7,
  batchSize = 1000
): Promise<number> {
  if (!Number.isFinite(now) || now < 0 ||
      !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90 ||
      !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("invalid_operation_timing_cleanup_options");
  }

  const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(
    "DELETE FROM operation_timing_samples WHERE id IN (SELECT id FROM operation_timing_samples WHERE measured_at < ? ORDER BY measured_at ASC LIMIT ?)"
  ).bind(cutoff, batchSize).run();

  return Number(result.meta.changes ?? 0);
}
