const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const MAX_REQUEST_BODY_BYTES = 1_048_576;

export function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie");
  if (!cookie) return false;
  return cookie.split(";").some(part => part.trim().startsWith("sp_session="));
}

/**
 * Browser-cookie authenticated mutations must originate from this exact origin.
 * SameSite cookies are site-scoped, not origin-scoped, so this also blocks
 * requests from a hostile sibling subdomain. Bearer-only API clients are not
 * constrained by this browser CSRF check.
 */
export function isCookieMutationSameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  if (!hasSessionCookie(request)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return fetchSite !== "cross-site";
}

/**
 * Buffer only mutation bodies and enforce the limit on bytes actually received,
 * not just the client-controlled Content-Length header. The returned Request
 * is safe to pass to the existing JSON/form parsers.
 */
export async function limitRequestBody(
  request: Request,
  maxBytes = MAX_REQUEST_BODY_BYTES
): Promise<Request | null> {
  if (!request.body) return request;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("invalid_body_limit");

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes) return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error("request_body_read_failed");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bytes,
    redirect: request.redirect,
    credentials: request.credentials,
    cache: request.cache,
    mode: request.mode,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity
  });
}
