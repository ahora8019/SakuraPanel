export function errorResponse(
  error: unknown,
  status = 500
): Response {
  const code = error instanceof Error ? error.message : "internal_error";

  const safeCodes = new Set([
    "unauthorized",
    "forbidden",
    "not_found",
    "rate_limited",
    "emergency_lock_active",
    "invalid_json",
    "validation_failed"
  ]);

  const publicCode = safeCodes.has(code) ? code : "internal_error";

  return Response.json(
    { ok: false, error: publicCode },
    { status }
  );
}