import type { Subscription, SubscriptionVersion } from "../models/subscription";

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByPublicTokenHash(tokenHash: string): Promise<Subscription | null>;
  /**
   * Fetches a subscription and its latest version in one D1 round trip.
   * Optional so non-D1/test repositories can keep the simpler interface.
   */
  findByPublicTokenHashWithLatestVersion?(
    tokenHash: string
  ): Promise<{ subscription: Subscription; version: SubscriptionVersion | null } | null>;
  listByUserId(userId: string): Promise<Subscription[]>;
  create(subscription: Subscription): Promise<void>;
  updateStatus(id: string, status: Subscription["status"], updatedAt: string): Promise<boolean>;
  updatePublicTokenHash(id: string, tokenHash: string, updatedAt: string): Promise<boolean>;
  getLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null>;
  saveVersion(version: SubscriptionVersion): Promise<void>;
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name ?? "Subscription"),
    status: row.status as Subscription["status"],
    expiresAt: row.expires_at == null ? undefined : String(row.expires_at),
    ...(row.public_token_hash == null ? {} : { publicTokenHash: String(row.public_token_hash) }),
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
      "SELECT id, user_id, name, status, expires_at, public_token_hash, created_at, updated_at FROM subscriptions WHERE id = ?"
    ).bind(id).first<Record<string, unknown>>();

    return row ? mapSubscription(row) : null;
  }

  async findByPublicTokenHash(tokenHash: string): Promise<Subscription | null> {
    const row = await this.db.prepare(
      "SELECT id, user_id, name, status, expires_at, public_token_hash, created_at, updated_at FROM subscriptions WHERE public_token_hash = ? LIMIT 1"
    ).bind(tokenHash).first<Record<string, unknown>>();
    return row ? mapSubscription(row) : null;
  }

  async findByPublicTokenHashWithLatestVersion(
    tokenHash: string
  ): Promise<{ subscription: Subscription; version: SubscriptionVersion | null } | null> {
    const row = await this.db.prepare(
      `SELECT
         s.id, s.user_id, s.name, s.status, s.expires_at, s.public_token_hash, s.created_at, s.updated_at,
         sv.id AS latest_version_id,
         sv.subscription_id AS latest_version_subscription_id,
         sv.version AS latest_version_number,
         sv.config_ids_json AS latest_config_ids_json,
         sv.created_at AS latest_version_created_at
       FROM subscriptions s
       LEFT JOIN subscription_versions sv
         ON sv.subscription_id = s.id
        AND sv.version = (
          SELECT MAX(v.version)
          FROM subscription_versions v
          WHERE v.subscription_id = s.id
        )
       WHERE s.public_token_hash = ?
       LIMIT 1`
    ).bind(tokenHash).first<Record<string, unknown>>();

    if (!row) return null;

    const subscription = mapSubscription(row);
    const version = row.latest_version_id == null
      ? null
      : mapVersion({
          id: row.latest_version_id,
          subscription_id: row.latest_version_subscription_id,
          version: row.latest_version_number,
          config_ids_json: row.latest_config_ids_json,
          created_at: row.latest_version_created_at
        });

    return { subscription, version };
  }

  async listByUserId(userId: string): Promise<Subscription[]> {
    const result = await this.db.prepare(
      "SELECT id, user_id, name, status, expires_at, public_token_hash, created_at, updated_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(userId).all<Record<string, unknown>>();
    return result.results.map(mapSubscription);
  }

  async create(subscription: Subscription): Promise<void> {
    await this.db.prepare(
      "INSERT INTO subscriptions (id,user_id,name,status,expires_at,created_at,updated_at,public_token_hash) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      subscription.id, subscription.userId, subscription.name ?? "Subscription", subscription.status,
      subscription.expiresAt ?? null, subscription.createdAt, subscription.updatedAt,
      subscription.publicTokenHash ?? null
    ).run();
  }

  async updateStatus(id: string, status: Subscription["status"], updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE subscriptions SET status=?, updated_at=? WHERE id=? AND (status<>'REVOKED' OR ?='REVOKED')"
    ).bind(status, updatedAt, id, status).run();
    return result.meta.changes > 0;
  }

  async updatePublicTokenHash(id: string, tokenHash: string, updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE subscriptions SET public_token_hash=?, updated_at=? WHERE id=?"
    ).bind(tokenHash, updatedAt, id).run();
    return result.meta.changes > 0;
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
