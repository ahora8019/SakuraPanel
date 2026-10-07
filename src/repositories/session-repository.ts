export interface SessionRecord {
  id: string;
  user_id: string;
  token_version: number;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
}

export interface SessionRepository {
  findActiveById(id: string, nowIso: string): Promise<SessionRecord | null>;
  touch(id: string, nowIso: string): Promise<void>;
  revoke(id: string, revokedAtIso: string): Promise<void>;
}

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async findActiveById(id: string, nowIso: string): Promise<SessionRecord | null> {
    return this.db
      .prepare(
        "SELECT * FROM auth_sessions WHERE id = ? AND revoked_at IS NULL AND expires_at > ?"
      )
      .bind(id, nowIso)
      .first<SessionRecord>();
  }

  async touch(id: string, nowIso: string): Promise<void> {
    await this.db
      .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
      .bind(nowIso, id)
      .run();
  }

  async revoke(id: string, revokedAtIso: string): Promise<void> {
    await this.db
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?")
      .bind(revokedAtIso, id)
      .run();
  }
}
