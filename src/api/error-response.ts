export function errorResponse(error: unknown, status = 500): Response {
  const code = error instanceof Error ? error.message : "internal_error";
  const safeCodes = new Set([
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "rate_limited",
    "device_limit_reached",
    "emergency_lock_active",
    "invalid_json",
    "validation_failed",
    "user_not_active",
    "template_not_found",
    "template_not_active",
    "invalid_expiration",
    "device_not_owned",
    "subscription_not_found",
    "subscription_expired",
    "subscription_not_active",
    "subscription_revoked_terminal",
    "no_eligible_configs",
    "version_not_found",
    "release_not_found",
    "service_not_configured",
    "owner_status_protected",
    "config_revoked_terminal"
  ]);
  const publicCode = safeCodes.has(code) ? code : "internal_error";
  return Response.json({ ok: false, error: publicCode }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}
