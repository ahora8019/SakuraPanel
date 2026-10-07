export class D1ConfigRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<unknown | null> {
    return this.db.prepare("SELECT * FROM configs WHERE id = ?").bind(id).first();
  }
}