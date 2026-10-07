export interface UserRecord {
  id: string;
  username: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class D1UserRepository {
  constructor(private readonly db: D1Database) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRecord>();
  }
}