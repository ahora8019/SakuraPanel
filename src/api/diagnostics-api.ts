import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { runDiagnostics } from "../core/diagnostics";
import type { Env } from "../index";

export class DiagnosticsApi {
  async get(context: SecurityContext | null, env: Env): Promise<Response> {
    try {
      requirePermission(context, "security:manage");
      const diagnostics = await runDiagnostics(env);
      return Response.json({ ok: diagnostics.ok, value: diagnostics }, {
        status: diagnostics.ok ? 200 : 503,
        headers: { "cache-control": "no-store" }
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status = code === "forbidden" ? 403 : 500;
      return Response.json({ ok: false, error: code === "forbidden" ? "forbidden" : "internal_error" }, {
        status,
        headers: { "cache-control": "no-store" }
      });
    }
  }
}
