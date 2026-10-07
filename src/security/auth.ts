import type { Role } from "./roles";
import { isRole } from "./roles";

export interface AuthPrincipal {
  userId: string;
  role: Role;
  sessionId: string;
  tokenVersion: number;
  securityVersion: number;
  issuedAt: number;
  expiresAt: number;
}

interface TokenPayload {
  sub: string;
  role: Role;
  sid: string;
  tv: number;
  sv: number;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(
  secret: string,
  data: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly issuer = "sakurapanel"
  ) {
    if (secret.length < 32) {
      throw new Error("auth_secret_too_short");
    }
  }

  async issueToken(
    principal: Omit<AuthPrincipal, "issuedAt" | "expiresAt">,
    ttlSeconds: number,
    now = Math.floor(Date.now() / 1000)
  ): Promise<string> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) {
      throw new Error("invalid_token_ttl");
    }

    if (
      !Number.isInteger(principal.tokenVersion) ||
      principal.tokenVersion < 1 ||
      !Number.isInteger(principal.securityVersion) ||
      principal.securityVersion < 1
    ) {
      throw new Error("invalid_session_version");
    }

    const payload: TokenPayload = {
      sub: principal.userId,
      role: principal.role,
      sid: principal.sessionId,
      tv: principal.tokenVersion,
      sv: principal.securityVersion,
      iat: now,
      exp: now + ttlSeconds
    };

    const header = base64UrlEncode(
      encoder.encode(JSON.stringify({
        alg: "HS256",
        typ: "SPAT",
        iss: this.issuer
      }))
    );
    const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const unsigned = header + "." + body;

    return unsigned + "." + await sign(this.secret, unsigned);
  }

  async verifyToken(
    token: string,
    now = Math.floor(Date.now() / 1000)
  ): Promise<AuthPrincipal | null> {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;

    let parsedHeader: { alg?: string; typ?: string; iss?: string };
    let payload: TokenPayload;

    try {
      parsedHeader = JSON.parse(
        new TextDecoder().decode(base64UrlDecode(header))
      );
      payload = JSON.parse(
        new TextDecoder().decode(base64UrlDecode(body))
      );
    } catch {
      return null;
    }

    if (
      parsedHeader.alg !== "HS256" ||
      parsedHeader.typ !== "SPAT" ||
      parsedHeader.iss !== this.issuer ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      !isRole(payload.role) ||
      !Number.isInteger(payload.tv) ||
      payload.tv < 1 ||
      !Number.isInteger(payload.sv) ||
      payload.sv < 1 ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp)
    ) {
      return null;
    }

    if (payload.exp <= now || payload.iat > now + 60) return null;

    if (!await verifySignature(this.secret, header + "." + body, signature)) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sid,
      tokenVersion: payload.tv,
      securityVersion: payload.sv,
      issuedAt: payload.iat,
      expiresAt: payload.exp
    };
  }

  static extractBearer(request: Request): string | null {
    const value = request.headers.get("Authorization");
    if (!value) return null;

    const [scheme, token, ...extra] = value.trim().split(/\s+/);
    return scheme?.toLowerCase() === "bearer" && token && extra.length === 0
      ? token
      : null;
  }
}
