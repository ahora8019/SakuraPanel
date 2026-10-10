import type { SubscriptionStatus } from "../models/subscription";
import { SubscriptionService } from "../core/subscription-service";
import { requirePermission, type SecurityContext } from "../security/security-middleware";
import { errorResponse } from "./error-response";
import { recordOperationTiming } from "../core/operation-timing";

export class SubscriptionApi {
  constructor(private readonly service: SubscriptionService, private readonly db?: D1Database) {}

  async list(context: SecurityContext | null, userId?: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:read");
      const target = ctx.principal.role === "MEMBER" ? ctx.principal.userId : (userId ?? ctx.principal.userId);
      return Response.json({ ok: true, value: (await this.service.listByUserId(target)).map(toPublicSubscription) });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async get(context: SecurityContext | null, id: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:read");
      const value = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && value.userId !== ctx.principal.userId) throw new Error("not_found");
      return Response.json({ ok: true, value: toPublicSubscription(value) });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async create(context: SecurityContext | null, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:write");
      if (!isCreateBody(body)) throw new Error("validation_failed");
      const userId = ctx.principal.role === "MEMBER" ? ctx.principal.userId : body.userId;
      const result = await this.service.create(userId, body.expiresAt);
      return Response.json({
        ok: true,
        value: toPublicSubscription(result.subscription),
        accessToken: result.accessToken
      }, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async rotateToken(context: SecurityContext | null, id: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:write");
      const subscription = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && subscription.userId !== ctx.principal.userId) throw new Error("not_found");
      const result = await this.service.rotateAccessToken(id);
      return Response.json({
        ok: true,
        value: toPublicSubscription(result.subscription),
        accessToken: result.accessToken
      }, { headers: { "cache-control": "no-store" } });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async provision(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    const startedAt = performance.now();
    try {
      const ctx = requirePermission(context, "subscription:write");
      const subscription = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && subscription.userId !== ctx.principal.userId) throw new Error("not_found");
      if (!isProvisionBody(body)) throw new Error("validation_failed");
      const value = await this.service.provision(id, body);
      const durationMs = Math.max(0, performance.now() - startedAt);
      await recordOperationTiming(this.db, "subscription_provision", durationMs);
      return Response.json({ ok: true, value }, { headers: { "Server-Timing": `subscription_provision;dur=${durationMs.toFixed(2)}`, "Cache-Control": "no-store" } });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async rebuild(context: SecurityContext | null, id: string): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:write");
      const subscription = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && subscription.userId !== ctx.principal.userId) throw new Error("not_found");
      const value = await this.service.rebuildVersion(id);
      return Response.json({ ok: true, value });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }

  async updateStatus(context: SecurityContext | null, id: string, body: unknown): Promise<Response> {
    try {
      const ctx = requirePermission(context, "subscription:write");
      const subscription = await this.service.get(id);
      if (ctx.principal.role === "MEMBER" && subscription.userId !== ctx.principal.userId) throw new Error("not_found");
      if (!isStatusBody(body)) throw new Error("validation_failed");
      return Response.json({ ok: true, value: toPublicSubscription(await this.service.updateStatus(id, body.status)) });
    } catch (error) { return errorResponse(error, statusFor(error)); }
  }
}

function toPublicSubscription(subscription: Awaited<ReturnType<SubscriptionService["get"]>>) {
  return {
    id: subscription.id,
    userId: subscription.userId,
    status: subscription.status,
    ...(subscription.expiresAt ? { expiresAt: subscription.expiresAt } : {}),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

function isProvisionBody(value: unknown): value is {
  templateId: string; deviceId?: string; expiresAt?: string;
} {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return typeof b.templateId === "string" &&
    (b.deviceId === undefined || typeof b.deviceId === "string") &&
    (b.expiresAt === undefined || typeof b.expiresAt === "string");
}

function isCreateBody(value: unknown): value is { userId: string; expiresAt?: string } {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return typeof b.userId === "string" && (b.expiresAt === undefined || typeof b.expiresAt === "string");
}

function isStatusBody(value: unknown): value is { status: SubscriptionStatus } {
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "ACTIVE" || status === "EXPIRED" || status === "REVOKED";
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "forbidden" || code === "user_not_active") return 403;
  if (code === "not_found" || code === "subscription_not_found" || code === "template_not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "validation_failed" || code === "invalid_expiration" || code === "subscription_expired" || code === "subscription_not_active" || code === "no_eligible_configs" || code === "device_not_owned") return 400;
  return 500;
}
