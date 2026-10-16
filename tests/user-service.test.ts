import { describe, expect, it, vi } from "vitest";
import { UserService } from "../src/core/user-service";
import type { D1UserRepository, UserRecord } from "../src/repositories/user-repository";

describe("owner account protection", () => {
  it("prevents deactivating the sole OWNER and avoids a permanent lockout", async () => {
    const owner: UserRecord = {
      id: "owner-1",
      username: "owner",
      role: "OWNER",
      status: "ACTIVE",
      security_version: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    };
    const updateStatus = vi.fn(async () => {});
    const repository = {
      findById: vi.fn(async () => owner),
      updateStatus
    } as unknown as D1UserRepository;
    const service = new UserService(repository);

    await expect(service.updateStatus(
      owner.id, "DISABLED", "OWNER", "2026-10-09T00:00:00.000Z"
    )).rejects.toThrow("owner_status_protected");

    await expect(service.updateStatus(
      owner.id, "SUSPENDED", "OWNER", "2026-10-09T00:00:00.000Z"
    )).rejects.toThrow("owner_status_protected");

    expect(updateStatus).not.toHaveBeenCalled();
  });
});
