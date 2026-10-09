import type { Device, DeviceStatus } from "../models/device";

export interface DeviceRepository {
  findById(id: string): Promise<Device | null>;
  listByUserId(userId: string): Promise<Device[]>;
  countActiveByUserId(userId: string): Promise<number>;
  create(device: Device): Promise<void>;
  /** Atomically enforces the active-device cap when inserting. */
  createIfBelowActiveLimit?(device: Device, limit: number): Promise<boolean>;
  /** Atomically enforces the active-device cap when reactivating a device. */
  activateIfBelowActiveLimit?(id: string, userId: string, limit: number, updatedAt: string): Promise<boolean>;
  updateStatus(id: string, status: DeviceStatus, updatedAt: string): Promise<void>;
}

export class D1DeviceRepository implements DeviceRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Device | null> {
    const row = await this.db.prepare("SELECT * FROM devices WHERE id = ?").bind(id).first<DeviceRow>();
    return row ? toDevice(row) : null;
  }

  async listByUserId(userId: string): Promise<Device[]> {
    const result = await this.db.prepare("SELECT * FROM devices WHERE user_id = ? ORDER BY created_at ASC").bind(userId).all<DeviceRow>();
    return result.results.map(toDevice);
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS count FROM devices WHERE user_id = ? AND status = 'ACTIVE'").bind(userId).first<{ count: number | string }>();
    return Number(row?.count ?? 0);
  }

  async create(device: Device): Promise<void> {
    await this.db.prepare(`INSERT INTO devices
      (id, user_id, name, device_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(device.id, device.userId, device.name, device.deviceType ?? null, device.status, device.createdAt, device.updatedAt)
      .run();
  }

  async createIfBelowActiveLimit(device: Device, limit: number): Promise<boolean> {
    const result = await this.db.prepare(`INSERT INTO devices
      (id, user_id, name, device_type, status, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM devices WHERE user_id = ? AND status = 'ACTIVE') < ?`)
      .bind(device.id, device.userId, device.name, device.deviceType ?? null, device.status,
        device.createdAt, device.updatedAt, device.userId, limit)
      .run();
    return Number(result.meta.changes ?? 0) > 0;
  }

  async activateIfBelowActiveLimit(id: string, userId: string, limit: number, updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(`UPDATE devices
      SET status = 'ACTIVE', updated_at = ?
      WHERE id = ? AND user_id = ? AND status <> 'ACTIVE'
        AND (SELECT COUNT(*) FROM devices WHERE user_id = ? AND status = 'ACTIVE') < ?`)
      .bind(updatedAt, id, userId, userId, limit)
      .run();
    return Number(result.meta.changes ?? 0) > 0;
  }

  async updateStatus(id: string, status: DeviceStatus, updatedAt: string): Promise<void> {
    await this.db.prepare("UPDATE devices SET status = ?, updated_at = ? WHERE id = ?").bind(status, updatedAt, id).run();
  }
}

interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  device_type: string | null;
  status: DeviceStatus;
  created_at: string;
  updated_at: string;
}

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    ...(row.device_type ? { deviceType: row.device_type } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
