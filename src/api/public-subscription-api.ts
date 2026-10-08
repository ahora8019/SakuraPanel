import { SubscriptionDeliveryService } from "../core/subscription-delivery";
import { errorResponse } from "./error-response";

export class PublicSubscriptionApi {
  constructor(private readonly service: SubscriptionDeliveryService) {}

  async get(token: string): Promise<Response> {
    try {
      const snapshot = await this.service.getSnapshot(token);
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
          "x-content-type-options": "nosniff"
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
      return errorResponse(error, 500);
    }
  }
}
