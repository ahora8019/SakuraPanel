import type { Env } from "../types/env";
import { runPulse } from "./v1-diagnostics";

export interface ScheduledPulseOutcome {
  status: "passed" | "failed" | "unavailable" | "running";
  scheduledSlot?: string;
  runId?: string;
  reason?: "database_binding_missing" | "another_run_in_progress" | "duplicate_slot" | "history_storage_failed";
}

export async function runScheduledPulse(env: Env, scheduledTime = Date.now()): Promise<ScheduledPulseOutcome> {
  if (!env.DB) return { status: "unavailable", reason: "database_binding_missing" };
  const date = new Date(scheduledTime);
  if (!Number.isFinite(date.getTime())) return { status: "unavailable", reason: "history_storage_failed" };

  const scheduledSlot = date.toISOString().slice(0, 13) + ":00:00Z";
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  try {
    const active = await env.DB.prepare(
      "SELECT id FROM system_check_runs WHERE status='running' AND started_at >= datetime('now','-2 hours') LIMIT 1"
    ).first<{ id: string }>();
    if (active) return { status: "running", scheduledSlot, reason: "another_run_in_progress" };

    const inserted = await env.DB.prepare(
      "INSERT INTO system_check_runs (id, scheduled_slot, status, started_at, completed_at, duration_ms, result_json) VALUES (?, ?, 'running', ?, NULL, 0, '{}') ON CONFLICT(scheduled_slot) DO NOTHING"
    ).bind(runId, scheduledSlot, startedAt).run();
    if (inserted.meta.changes === 0) return { status: "running", scheduledSlot, reason: "duplicate_slot" };

    const report = await runPulse(env);
    const finalStatus = report.status === "passed" ? "passed" : report.status === "failed" ? "failed" : "unavailable";
    await env.DB.prepare(
      "UPDATE system_check_runs SET status=?, completed_at=?, duration_ms=?, result_json=? WHERE id=?"
    ).bind(finalStatus, new Date().toISOString(), report.durationMs, JSON.stringify(report), runId).run();

    // Keep history bounded by age and row count; never store credentials or raw request data.
    await env.DB.prepare("DELETE FROM system_check_runs WHERE started_at < datetime('now','-30 days')").run();
    await env.DB.prepare(
      "DELETE FROM system_check_runs WHERE id IN (SELECT id FROM system_check_runs ORDER BY started_at DESC LIMIT -1 OFFSET 1000)"
    ).run();

    return { status: finalStatus, scheduledSlot, runId };
  } catch {
    // Never log exception text from database/runtime errors; it may include sensitive context.
    return { status: "unavailable", scheduledSlot, runId, reason: "history_storage_failed" };
  }
}
