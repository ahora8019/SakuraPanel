import { describe, expect, it, vi } from "vitest";
import { SubscriptionService } from "../src/core/subscription-service";
import type { Subscription } from "../src/models/subscription";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";
import type { ConfigRepository } from "../src/repositories/config-repository";

describe("subscription revocation lifecycle", () => {
  it("does not allow any status transition away from REVOKED", async () => {
    const revoked: Subscription = {
      id: "sub-1",
      userId: "user-1",
      status: "REVOKED",
      publicTokenHash: "hash",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const updateStatus = vi.fn(async () => true);
    const repository = {
      findById: vi.fn(async () => revoked),
      updateStatus,
      getLatestVersion: vi.fn(async () => null)
    } as unknown as SubscriptionRepository;
    const service = new SubscriptionService(repository, {} as ConfigRepository);

    await expect(service.updateStatus("sub-1", "ACTIVE", "2026-10-09T00:00:00.000Z"))
      .rejects.toThrow("subscription_revoked_terminal");
    await expect(service.updateStatus("sub-1", "EXPIRED", "2026-10-09T00:00:00.000Z"))
      .rejects.toThrow("subscription_revoked_terminal");
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
