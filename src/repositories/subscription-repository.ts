import type { Subscription, SubscriptionVersion } from "../models/subscription";

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null>;
  saveVersion(version: SubscriptionVersion): Promise<void>;
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as Subscription["status"],
    expiresAt: row.expires_at == null ? undefined : String(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapVersion(row: Record<string, unknown>): SubscriptionVersion {
  let configIds: string[] = [];
  try {
    const parsed = JSON.parse(String(row.config_ids_json));
    if (Array.isArray(parsed)) configIds = parsed.map(String);
  } catch {
    configIds = [];
  }

  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    version: Number(row.version),
    configIds,
    createdAt: String(row.created_at)
  };
}

export class D1SubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Subscription | null> {
    const row = await this.db.prepare(
      "SELECT id, user_id, status, expires_at, created_at, updated_at FROM subscriptions WHERE id = ?"
    ).bind(id).first<Record<string, unknown>>();

    return row ? mapSubscription(row) : null;
  }

  async getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    const row = await this.db.prepare(
      "SELECT id, subscription_id, version, config_ids_json, created_at FROM subscription_versions WHERE subscription_id = ? ORDER BY version DESC LIMIT 1"
    ).bind(subscriptionId).first<Record<string, unknown>>();

    return row ? mapVersion(row) : null;
  }

  async saveVersion(version: SubscriptionVersion): Promise<void> {
    await this.db.prepare(`INSERT INTO subscription_versions
      (id, subscription_id, version, config_ids_json, created_at)
      VALUES (?, ?, ?, ?, ?)`
    ).bind(
      version.id,
      version.subscriptionId,
      version.version,
      JSON.stringify(version.configIds),
      version.createdAt
    ).run();
  }
}
