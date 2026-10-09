import { describe, expect, it } from "vitest";
import { SubscriptionDeliveryService } from "../src/core/subscription-delivery";
import type { GeneratedConfig } from "../src/models/config";
import type { Subscription, SubscriptionVersion } from "../src/models/subscription";
import type { CompatibilityMatrixTarget } from "../src/models/config-compatibility";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";
import { generateSubscriptionToken, hashSubscriptionToken } from "../src/core/subscription-token";

class MemoryConfigRepository implements ConfigRepository {
  constructor(private readonly values: GeneratedConfig[]) {}
  async findById(id: string) { return this.values.find(value => value.id === id) ?? null; }
  async listByUserId(userId: string) { return this.values.filter(value => value.userId === userId); }
  async listByIds(ids: string[]) { return ids.map(id => this.values.find(value => value.id === id)).filter((value): value is GeneratedConfig => Boolean(value)); }
  async save() {}
  async updateStatus() { return true; }
  async updatePublicTokenHash() { return true; }
  async getLatestVersion() { return 1; }
  async saveVersion() {}
}

class MemorySubscriptionRepository implements SubscriptionRepository {
  private current: Subscription;
  constructor(subscription: Subscription, private readonly version: SubscriptionVersion) {
    this.current = subscription;
  }
  async findById(id: string) { return id === this.current.id ? this.current : null; }
  async findByPublicTokenHash(hash: string) { return hash === this.current.publicTokenHash ? this.current : null; }
  async findByPublicTokenHashWithLatestVersion(hash: string) {
    return hash === this.current.publicTokenHash
      ? { subscription: this.current, version: this.version }
      : null;
  }
  async listByUserId() { return [this.current]; }
  async create(subscription: Subscription) { this.current = subscription; }
  async updatePublicTokenHash(id: string, tokenHash: string, updatedAt: string) {
    if (id !== this.current.id) return false;
    this.current = { ...this.current, publicTokenHash: tokenHash, updatedAt };
    return true;
  }
  async updateStatus(id: string, status: Subscription["status"], updatedAt: string) {
    if (id !== this.current.id) return false;
    this.current = { ...this.current, status, updatedAt };
    return true;
  }
  async getLatestVersion(id: string) { return id === this.version.subscriptionId ? this.version : null; }
  async saveVersion() {}
}

describe("subscription public delivery", () => {
  it("generates an opaque token and only stores its digest", async () => {
    const token = generateSubscriptionToken();
    const hash = await hashSubscriptionToken(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toBe(token);
  });

  it("returns only active configs from the latest snapshot", async () => {
    const token = generateSubscriptionToken();
    const hash = await hashSubscriptionToken(token);
    const subscription: Subscription = {
      id: "sub-1", userId: "user-1", status: "ACTIVE", publicTokenHash: hash,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const configs: GeneratedConfig[] = [
      { id: "cfg-1", userId: "user-1", templateId: "tpl", templateVersion: 1, payload: { ok: 1 }, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "cfg-2", userId: "user-1", templateId: "tpl", templateVersion: 1, payload: { ok: 2 }, status: "REVOKED", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    const version: SubscriptionVersion = { id: "v1", subscriptionId: "sub-1", version: 1, configIds: ["cfg-1", "cfg-2"], createdAt: "2026-01-01T00:00:00.000Z" };
    const service = new SubscriptionDeliveryService(
      new MemorySubscriptionRepository(subscription, version),
      new MemoryConfigRepository(configs)
    );

    const snapshot = await service.getSnapshot(token, "2026-01-01T00:01:00.000Z");
    expect(snapshot.version).toBe(1);
    expect(snapshot.configs.map(config => config.id)).toEqual(["cfg-1"]);
  });

  it("does not reveal whether an invalid token belongs to a subscription", async () => {
    const subscription: Subscription = {
      id: "sub-1", userId: "user-1", status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const version: SubscriptionVersion = { id: "v1", subscriptionId: "sub-1", version: 1, configIds: ["cfg-1"], createdAt: "2026-01-01T00:00:00.000Z" };
    const service = new SubscriptionDeliveryService(
      new MemorySubscriptionRepository(subscription, version),
      new MemoryConfigRepository([])
    );

    await expect(service.getSnapshot("invalid-token", "2026-01-01T00:01:00.000Z")).rejects.toThrow("not_found");
  });
  it("delivers only fully compatible configs when a target is requested", async () => {
    const token = generateSubscriptionToken();
    const hash = await hashSubscriptionToken(token);
    const subscription: Subscription = {
      id: "sub-2", userId: "user-1", status: "ACTIVE", publicTokenHash: hash,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const compatibility = { platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], features: ["TCP", "TLS"] };
    const configs: GeneratedConfig[] = [
      { id: "compatible", userId: "user-1", templateId: "tpl", templateVersion: 1, payload: { compatibility }, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "wrong-platform", userId: "user-1", templateId: "tpl", templateVersion: 1, payload: { compatibility: { ...compatibility, platform: "IOS" } }, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "unknown", userId: "user-1", templateId: "tpl", templateVersion: 1, payload: {}, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    const version: SubscriptionVersion = { id: "v2", subscriptionId: "sub-2", version: 2, configIds: ["wrong-platform", "compatible", "unknown"], createdAt: "2026-01-01T00:00:00.000Z" };
    const target: CompatibilityMatrixTarget = { platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"], features: ["TCP", "TLS"] };
    const service = new SubscriptionDeliveryService(new MemorySubscriptionRepository(subscription, version), new MemoryConfigRepository(configs));

    const snapshot = await service.getSnapshot(token, "2026-01-01T00:01:00.000Z", target);
    expect(snapshot.configs.map(config => config.id)).toEqual(["compatible"]);
  });

  it("fails closed when compatibility filtering leaves no deliverable config", async () => {
    const token = generateSubscriptionToken();
    const hash = await hashSubscriptionToken(token);
    const subscription: Subscription = {
      id: "sub-3", userId: "user-1", status: "ACTIVE", publicTokenHash: hash,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const config: GeneratedConfig = {
      id: "incompatible", userId: "user-1", templateId: "tpl", templateVersion: 1,
      payload: { compatibility: { platform: "IOS", protocol: "VLESS", clients: ["v2rayNG"] } },
      status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z"
    };
    const version: SubscriptionVersion = { id: "v3", subscriptionId: "sub-3", version: 3, configIds: [config.id], createdAt: "2026-01-01T00:00:00.000Z" };
    const target: CompatibilityMatrixTarget = { platform: "ANDROID", protocol: "VLESS", clients: ["v2rayNG"] };
    const service = new SubscriptionDeliveryService(new MemorySubscriptionRepository(subscription, version), new MemoryConfigRepository([config]));

    await expect(service.getSnapshot(token, "2026-01-01T00:01:00.000Z", target)).rejects.toThrow("no_eligible_configs");
  });

});
