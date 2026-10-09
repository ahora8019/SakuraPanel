import type { ConfigIdentity, GeneratedConfig } from "../models/config";
import type { ConfigTemplate } from "../models/template";

export interface ConfigGenerationContext {
  identity: ConfigIdentity;
  template: ConfigTemplate;
  expiresAt?: string;
  now?: string;
  payloadOverrides?: Record<string, unknown>;
}

export class ConfigEngine {
  generate(context: ConfigGenerationContext): GeneratedConfig {
    if (context.template.status !== "ACTIVE") {
      throw new Error("template_not_active");
    }

    const createdAt = context.now ?? new Date().toISOString();

    const payload = {
      ...context.template.definition,
      ...(context.payloadOverrides ?? {}),
      identity: {
        userId: context.identity.userId,
        ...(context.identity.deviceId ? { deviceId: context.identity.deviceId } : {})
      },
      metadata: {
        templateId: context.template.id,
        templateVersion: context.template.version
      }
    };

    return {
      id: crypto.randomUUID(),
      userId: context.identity.userId,
      ...(context.identity.deviceId ? { deviceId: context.identity.deviceId } : {}),
      templateId: context.template.id,
      templateVersion: context.template.version,
      payload,
      status: "ACTIVE",
      ...(context.expiresAt ? { expiresAt: context.expiresAt } : {}),
      createdAt
    };
  }
}
