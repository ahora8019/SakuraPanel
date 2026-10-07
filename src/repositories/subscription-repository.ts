export class D1SubscriptionRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<unknown | null> {
    return this.db.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(id).first();
  }
}