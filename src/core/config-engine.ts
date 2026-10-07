import type { Endpoint } from "../models/endpoint";
import type { ConfigIdentity, GeneratedConfig } from "../models/config";
import type { ConfigTemplate } from "../models/template";

export interface ConfigGenerationContext {
  identity: ConfigIdentity;
  endpoint: Endpoint;
  template: ConfigTemplate;
  expiresAt?: string;
  now?: string;
}

export class ConfigEngine {
  generate(context: ConfigGenerationContext): GeneratedConfig {
    if (context.template.status !== "ACTIVE") {
      throw new Error("template_not_active");
    }

    if (!["HEALTHY", "DEGRADED"].includes(context.endpoint.status)) {
      throw new Error("endpoint_not_eligible");
    }

    const createdAt = context.now ?? new Date().toISOString();

    const payload = {
      ...context.template.definition,
      endpoint: {
        id: context.endpoint.id,
        host: context.endpoint.host,
        port: context.endpoint.port,
        transport: context.endpoint.transport,
        tls: context.endpoint.tls
      },
      identity: {
        userId: context.identity.userId,
        ...(context.identity.deviceId
          ? { deviceId: context.identity.deviceId }
          : {})
      },
      metadata: {
        templateId: context.template.id,
        templateVersion: context.template.version
      }
    };

    return {
      id: crypto.randomUUID(),
      userId: context.identity.userId,
      deviceId: context.identity.deviceId,
      endpointId: context.endpoint.id,
      templateId: context.template.id,
      templateVersion: context.template.version,
      payload,
      status: "ACTIVE",
      expiresAt: context.expiresAt,
      createdAt
    };
  }
}