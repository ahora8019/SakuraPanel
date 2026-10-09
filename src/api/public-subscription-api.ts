import { SubscriptionDeliveryService } from "../core/subscription-delivery";
import { parseCompatibilityTarget } from "../core/compatibility-target";
import { errorResponse } from "./error-response";

const PUBLIC_HEADERS = {
  "cache-control": "private, no-store",
  "pragma": "no-cache",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "x-frame-options": "DENY",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "cross-origin-resource-policy": "same-origin"
} as const;

export class PublicSubscriptionApi {
  constructor(private readonly service: SubscriptionDeliveryService) {}

  async get(token: string, searchParams?: URLSearchParams): Promise<Response> {
    try {
      const target = searchParams && [...searchParams.keys()].length > 0
        ? parseCompatibilityTarget(searchParams)
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
      }, { headers: PUBLIC_HEADERS });
    } catch (error) {
      const code = error instanceof Error ? error.message : "internal_error";
      if (code === "not_found" || code === "subscription_expired" || code === "no_eligible_configs") {
        return Response.json({ ok: false, error: "not_found" }, {
          status: 404,
          headers: PUBLIC_HEADERS
        });
      }
      if (code === "validation_failed") return Response.json({ ok: false, error: "validation_failed" }, {
        status: 400,
        headers: PUBLIC_HEADERS
      });
      const response = errorResponse(error, 500);
      for (const [name, value] of Object.entries(PUBLIC_HEADERS)) {
        response.headers.set(name, value);
      }
      return response;
    }
  }
}

