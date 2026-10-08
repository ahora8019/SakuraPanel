import { SubscriptionDeliveryService } from "../core/subscription-delivery";
import type { ClientPlatform, ClientProtocol, CompatibilityFeature, CompatibilityMatrixTarget } from "../models/config-compatibility";
import { errorResponse } from "./error-response";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];
const FEATURES: readonly CompatibilityFeature[] = ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC", "HTTP2", "QUIC"];

export class PublicSubscriptionApi {
  constructor(private readonly service: SubscriptionDeliveryService) {}

  async get(token: string, searchParams?: URLSearchParams): Promise<Response> {
    try {
      const target = searchParams && hasCompatibilityTarget(searchParams)
        ? parseTarget(searchParams)
        : undefined;
      const snapshot = await this.service.getSnapshot(token, new Date().toISOString(), target);
      return Response.json({
        ok: true,
        value: {
          version: snapshot.version,
          ...(snapshot.expiresAt ? { expiresAt: snapshot.expiresAt } : {}),
          configs: snapshot.configs.map(config => ({
            id: config.id,
            deviceId: config.deviceId,
            templateId: config.templateId,
            templateVersion: config.templateVersion,
            payload: config.payload,
            expiresAt: config.expiresAt
          }))
        }
      }, {
        headers: {
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
          "x-frame-options": "DENY",
          "permissions-policy": "geolocation=(), microphone=(), camera=()",
          "cross-origin-resource-policy": "same-origin"
        }
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "internal_error";
      if (code === "not_found" || code === "subscription_expired" || code === "no_eligible_configs") {
        return Response.json({ ok: false, error: "not_found" }, {
          status: 404,
          headers: { "cache-control": "no-store" }
        });
      }
      if (code === "validation_failed") return Response.json({ ok: false, error: "validation_failed" }, {
        status: 400,
        headers: { "cache-control": "no-store" }
      });
      return errorResponse(error, 500);
    }
  }
}

function hasCompatibilityTarget(params: URLSearchParams): boolean {
  return ["platform", "protocol", "client", "feature"].some(key => params.has(key));
}

function parseTarget(params: URLSearchParams): CompatibilityMatrixTarget {
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
