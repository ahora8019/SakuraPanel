import type { User, UserStatus } from "../models/user";
import type { D1UserRepository, UserRecord } from "../repositories/user-repository";
import { isRole, type Role } from "../security/roles";

export class UserService {
  constructor(private readonly users: D1UserRepository) {}
  async list(): Promise<User[]> { const result = await this.users.list(); return result.results.map(toUser); }

  async create(input: { username: string; role: Role; now: string }): Promise<User> {
    if (!isRole(input.role)) throw new Error("validation_failed");
    const username = input.username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) throw new Error("validation_failed");
    if (await this.users.findByUsername(username)) throw new Error("conflict");
    const user: UserRecord = { id: crypto.randomUUID(), username, role: input.role, status: "ACTIVE", security_version: 1, created_at: input.now, updated_at: input.now };
    await this.users.create(user);
    return toUser(user);
  }

  async updateStatus(id: string, status: UserStatus, now: string): Promise<User> {
    const current = await this.users.findById(id);
    if (!current) throw new Error("not_found");
    if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) throw new Error("validation_failed");
    await this.users.updateStatus(id, status, now);
    const updated = await this.users.findById(id);
    if (!updated) throw new Error("not_found");
    return toUser(updated);
  }
}
function toUser(row: UserRecord): User {
  return { id: row.id, username: row.username, role: row.role, status: row.status, securityVersion: row.security_version, createdAt: row.created_at, updatedAt: row.updated_at };
}
