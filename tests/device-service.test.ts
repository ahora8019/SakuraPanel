import { describe, expect, it, vi } from "vitest";
import { DeviceService } from "../src/core/device-service";
import type { Device } from "../src/models/device";
import type { D1DeviceRepository } from "../src/repositories/device-repository";
import type { D1UserRepository, UserRecord } from "../src/repositories/user-repository";

const activeUser: UserRecord = {
  id: "u1", username: "user1", role: "MEMBER", status: "ACTIVE",
  security_version: 1, created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z"
};

describe("device active limit", () => {
  it("uses the atomic repository insert instead of a racy count-then-insert", async () => {
    const createIfBelowActiveLimit = vi.fn(async () => false);
    const countActiveByUserId = vi.fn(async () => 4);
    const devices = {
      findById: vi.fn(async () => null),
      countActiveByUserId,
      create: vi.fn(async () => {}),
      createIfBelowActiveLimit,
      updateStatus: vi.fn(async () => {}),
      listByUserId: vi.fn(async () => [])
    } as unknown as D1DeviceRepository;
    const users = { findById: vi.fn(async () => activeUser) } as unknown as D1UserRepository;
    const service = new DeviceService(devices, users);

    await expect(service.create({
      userId: "u1", name: "phone", now: "2026-10-09T00:00:00.000Z"
    })).rejects.toThrow("device_limit_reached");

    expect(createIfBelowActiveLimit).toHaveBeenCalledTimes(1);
    expect(countActiveByUserId).not.toHaveBeenCalled();
  });

  it("uses an atomic conditional update when reactivating a device", async () => {
    const device: Device = {
      id: "d1", userId: "u1", name: "phone", status: "DISABLED",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const activateIfBelowActiveLimit = vi.fn(async () => false);
    const countActiveByUserId = vi.fn(async () => 4);
    const devices = {
      findById: vi.fn(async () => device),
      countActiveByUserId,
      create: vi.fn(async () => {}),
      activateIfBelowActiveLimit,
      updateStatus: vi.fn(async () => {}),
      listByUserId: vi.fn(async () => [])
    } as unknown as D1DeviceRepository;
    const users = { findById: vi.fn(async () => activeUser) } as unknown as D1UserRepository;
    const service = new DeviceService(devices, users);

    await expect(service.updateStatus("d1", "ACTIVE", "2026-10-09T00:00:00.000Z"))
      .rejects.toThrow("device_limit_reached");

    expect(activateIfBelowActiveLimit).toHaveBeenCalledTimes(1);
    expect(countActiveByUserId).not.toHaveBeenCalled();
  });
});
