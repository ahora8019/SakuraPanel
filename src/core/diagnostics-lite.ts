import type { Env } from "../types/env";

export async function runReadiness(env: Env): Promise<boolean> {
  if (!env.DB) return false;
  try {
    await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return true;
  } catch {
    return false;
  }
}
