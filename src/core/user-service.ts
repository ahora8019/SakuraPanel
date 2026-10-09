import type { User, UserStatus } from "../models/user";
import type { D1UserRepository, UserRecord } from "../repositories/user-repository";
import { isRole, roleRank, type Role } from "../security/roles";

export class UserService {
  constructor(private readonly users: D1UserRepository) {}
  async list(): Promise<User[]> { const result = await this.users.list(); return result.results.map(toUser); }

  async create(input: { username: string; role: Role; actorRole: Role; now: string }): Promise<User> {
    if (!isRole(input.role) || !isRole(input.actorRole)) throw new Error("validation_failed");
    if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") throw new Error("forbidden");
    if (input.actorRole !== "OWNER" && input.role !== "MEMBER") throw new Error("forbidden");
    const username = input.username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) throw new Error("validation_failed");
    if (await this.users.findByUsername(username)) throw new Error("conflict");
    const user: UserRecord = { id: crypto.randomUUID(), username, role: input.role, status: "ACTIVE", security_version: 1, created_at: input.now, updated_at: input.now };
    await this.users.create(user);
    return toUser(user);
  }

  async updateStatus(id: string, status: UserStatus, actorRole: Role, now: string): Promise<User> {
    const current = await this.users.findById(id);
    if (!current) throw new Error("not_found");
    if (!isRole(actorRole) || !["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) throw new Error("validation_failed");
    if (actorRole !== "OWNER" && roleRank(actorRole) <= roleRank(current.role)) throw new Error("forbidden");
    if (current.role === "OWNER" && current.status === "ACTIVE" && status !== "ACTIVE") {
      if (await this.users.countActiveOwners() <= 1) throw new Error("last_active_owner");
    }
    await this.users.updateStatus(id, status, now);
    const updated = await this.users.findById(id);
    if (!updated) throw new Error("not_found");
    return toUser(updated);
  }
}
function toUser(row: UserRecord): User {
  return { id: row.id, username: row.username, role: row.role, status: row.status, securityVersion: row.security_version, createdAt: row.created_at, updatedAt: row.updated_at };
}
