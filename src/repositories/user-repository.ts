import type { Role } from "../security/roles";
import type { UserStatus } from "../models/user";

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
}

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  status: UserStatus;
  security_version: number;
  created_at: string;
  updated_at: string;
}

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: D1Database) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRecord>();
  }

  findByUsername(username: string): Promise<UserRecord | null> {
    return this.db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<UserRecord>();
  }

  list(): Promise<D1Result<UserRecord>> {
    return this.db.prepare("SELECT * FROM users ORDER BY created_at ASC").all<UserRecord>();
  }

  async countActiveOwners(): Promise<number> {
    const result = await this.db.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'OWNER' AND status = 'ACTIVE'"
    ).first<{ count: number }>();
    return result?.count ?? 0;
  }

  async create(user: UserRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO users
      (id, username, role, status, security_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(user.id, user.username, user.role, user.status, user.security_version, user.created_at, user.updated_at)
      .run();
  }

  async updateStatus(id: string, status: UserStatus, updatedAt: string): Promise<void> {
    await this.db.prepare("UPDATE users SET status = ?, security_version = security_version + 1, updated_at = ? WHERE id = ?")
      .bind(status, updatedAt, id).run();
  }
}
