import { evaluateCompatibilityMatrix } from "../core/config-compatibility";
import type { ConfigCompatibility, ClientPlatform, ClientProtocol, CompatibilityFeature } from "../models/config-compatibility";
import { ConfigService } from "../core/config-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];
const FEATURES: readonly CompatibilityFeature[] = ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC", "HTTP2", "QUIC"];

export class ConfigCompatibilityApi {
  constructor(private readonly service: ConfigService) {}

  async get(context: SecurityContext | null, id: string, searchParams: URLSearchParams): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:read");
      const config = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && config.userId !== ctx.principal.userId) throw new Error("not_found");

      const target = parseTarget(searchParams);
      return Response.json(
        { ok: true, value: evaluateCompatibilityMatrix(config, target) },
        { headers: { "cache-control": "no-store" } }
      );
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function parseTarget(params: URLSearchParams): ConfigCompatibility {
  const platform = params.get("platform");
  const protocol = params.get("protocol");
  const clients = params.getAll("client");
  const features = params.getAll("feature");

  if (!PLATFORMS.includes(platform as ClientPlatform) ||
      !PROTOCOLS.includes(protocol as ClientProtocol) ||
      clients.length === 0 || clients.length > 32 ||
      clients.some(client => !/^[A-Za-z0-9._ -]{1,64}$/.test(client)) ||
      features.length > FEATURES.length ||
      features.some(feature => !FEATURES.includes(feature as CompatibilityFeature))) {
    throw new Error("validation_failed");
  }

  return {
    platform: platform as ClientPlatform,
    protocol: protocol as ClientProtocol,
    clients,
    ...(features.length > 0 ? { features: features as CompatibilityFeature[] } : {})
  };
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "validation_failed") return 400;
  return 500;
}
