import { ConfigService } from "../core/config-service";
import { TemplateService } from "../core/template-service";
import { SubscriptionService } from "../core/subscription-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";

const SUPPORTED_PROTOCOLS = ["VLESS", "VMess", "Trojan", "Shadowsocks"] as const;
type SupportedProtocol = typeof SUPPORTED_PROTOCOLS[number];

interface GeneratorInput {
  protocol: SupportedProtocol;
  port: number;
  subscriptionName: string;
  count: number;
}

export class ConfigGeneratorApi {
  constructor(
    private readonly configs: ConfigService,
    private readonly templates: TemplateService,
    private readonly subscriptions: SubscriptionService
  ) {}

  async generate(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "config:write");
      if (!isGeneratorInput(body)) throw new Error("validation_failed");

      const template = (await this.templates.list("ACTIVE")).find(
        item => item.protocol.toLowerCase() === body.protocol.toLowerCase()
      );
      if (!template) throw new Error("template_not_found");
      if (!isTemplateReady(template.definition, body.protocol)) throw new Error("template_not_ready");

      const createdAt = new Date().toISOString();
      const { subscription, accessToken } = await this.subscriptions.create(
        ctx.principal.userId,
        undefined,
        createdAt,
        body.subscriptionName
      );

      const configs = await this.configs.generateBatch({
        identity: { userId: ctx.principal.userId },
        templateId: template.id,
        count: body.count,
        now: createdAt,
        payloadOverrides: (index, total) => ({
          protocol: body.protocol,
          port: body.port,
          name: body.subscriptionName + "-" + index,
          subscriptionName: body.subscriptionName,
          generator: { index, total }
        })
      });

      const version = await this.subscriptions.recordGeneratedConfigs(
        subscription.id,
        configs.map(config => config.id),
        createdAt
      );

      return Response.json({
        ok: true,
        value: {
          subscription: {
            id: subscription.id,
            name: subscription.name ?? body.subscriptionName,
            status: subscription.status,
            configCount: configs.length,
            version: version.version
          },
          configs: configs.map(config => ({
            id: config.id,
            name: String(config.payload.name ?? config.id),
            protocol: String(config.payload.protocol ?? body.protocol),
            port: Number(config.payload.port ?? body.port),
            status: config.status
          })),
          accessToken
        }
      }, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error, statusFor(error));
    }
  }
}

function isGeneratorInput(value: unknown): value is GeneratorInput {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.protocol === "string" &&
    (SUPPORTED_PROTOCOLS as readonly string[]).includes(body.protocol) &&
    typeof body.port === "number" && Number.isInteger(body.port) && body.port >= 1 && body.port <= 65535 &&
    typeof body.subscriptionName === "string" && body.subscriptionName.trim().length >= 1 &&
    body.subscriptionName.trim().length <= 64 &&
    typeof body.count === "number" && Number.isInteger(body.count) && body.count >= 1 && body.count <= 100;
}

function isTemplateReady(definition: Record<string, unknown>, protocol: SupportedProtocol): boolean {
  if (typeof definition.server !== "string" || !definition.server.trim()) return false;
  if (protocol === "VLESS" || protocol === "VMess") {
    return typeof definition.uuid === "string" && definition.uuid.trim().length > 0;
  }
  if (protocol === "Trojan") {
    return typeof definition.password === "string" && definition.password.length > 0;
  }
  return typeof definition.password === "string" && definition.password.length > 0 &&
    typeof definition.method === "string" && definition.method.trim().length > 0;
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden" || code === "user_not_active") return 403;
  if (code === "not_found" || code === "template_not_found" || code === "subscription_not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "validation_failed" || code === "template_not_ready" || code === "invalid_expiration" ||
      code === "subscription_expired" || code === "subscription_not_active") return 400;
  return 500;
}
