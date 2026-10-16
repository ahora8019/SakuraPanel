import type { Device, DeviceStatus } from "../models/device";
import type { DeviceRepository } from "../repositories/device-repository";
import { D1UserRepository } from "../repositories/user-repository";

const MAX_ACTIVE_DEVICES_PER_USER = 5;

export class DeviceService {
  constructor(private readonly devices: DeviceRepository, private readonly users: D1UserRepository) {}
  async listForUser(userId: string): Promise<Device[]> {
    if (!(await this.users.findById(userId))) throw new Error("not_found");
    return this.devices.listByUserId(userId);
  }
  async create(input: { userId: string; name: string; deviceType?: string; now: string }): Promise<Device> {
    const user = await this.users.findById(input.userId);
    if (!user || user.status !== "ACTIVE") throw new Error("forbidden");
    const name = input.name.trim();
    if (name.length < 1 || name.length > 64) throw new Error("validation_failed");
    const device: Device = { id: crypto.randomUUID(), userId: input.userId, name, ...(input.deviceType?.trim() ? { deviceType: input.deviceType.trim().slice(0, 32) } : {}), status: "ACTIVE", createdAt: input.now, updatedAt: input.now };
    if (this.devices.createIfBelowActiveLimit) {
      if (!(await this.devices.createIfBelowActiveLimit(device, MAX_ACTIVE_DEVICES_PER_USER))) {
        throw new Error("device_limit_reached");
      }
    } else {
      if (await this.devices.countActiveByUserId(input.userId) >= MAX_ACTIVE_DEVICES_PER_USER) throw new Error("device_limit_reached");
      await this.devices.create(device);
    }
    return device;
  }
  async updateStatus(id: string, status: DeviceStatus, now: string): Promise<Device> {
    const device = await this.devices.findById(id);
    if (!device) throw new Error("not_found");
    if (status !== "ACTIVE" && status !== "DISABLED") throw new Error("validation_failed");
    if (status === "ACTIVE" && device.status !== "ACTIVE" && this.devices.activateIfBelowActiveLimit) {
      if (!(await this.devices.activateIfBelowActiveLimit(id, device.userId, MAX_ACTIVE_DEVICES_PER_USER, now))) {
        // A concurrent request may already have activated this same device.
        const latest = await this.devices.findById(id);
        if (!latest || latest.status !== "ACTIVE") throw new Error("device_limit_reached");
      }
    } else {
      if (status === "ACTIVE" && device.status !== "ACTIVE" &&
          await this.devices.countActiveByUserId(device.userId) >= MAX_ACTIVE_DEVICES_PER_USER) {
        throw new Error("device_limit_reached");
      }
      await this.devices.updateStatus(id, status, now);
    }
    const updated = await this.devices.findById(id);
    if (!updated) throw new Error("not_found");
    return updated;
  }
}
