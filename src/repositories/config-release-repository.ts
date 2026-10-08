import type { ConfigRelease, ConfigReleaseStatus } from "../models/config-release";

export interface ConfigReleaseRepository {
  find(configId: string, version: number): Promise<ConfigRelease | null>;
  list(configId: string): Promise<ConfigRelease[]>;
  publish(configId: string, version: number, actorId: string, now: string): Promise<ConfigRelease>;
}

function mapRelease(row: Record<string, unknown>): ConfigRelease {
  return {
    id: String(row.id),
    configId: String(row.config_id),
    version: Number(row.version),
    status: row.status as ConfigReleaseStatus,
    actorId: String(row.actor_id),
    createdAt: String(row.created_at),
    ...(row.published_at ? { publishedAt: String(row.published_at) } : {}),
    ...(row.rolled_back_at ? { rolledBackAt: String(row.rolled_back_at) } : {})
  };
}

export class D1ConfigReleaseRepository implements ConfigReleaseRepository {
  constructor(private readonly db: D1Database) {}

  async find(configId: string, version: number): Promise<ConfigRelease | null> {
    const row = await this.db.prepare(
      "SELECT id,config_id,version,status,actor_id,created_at,published_at,rolled_back_at FROM config_releases WHERE config_id=? AND version=?"
    ).bind(configId, version).first<Record<string, unknown>>();
    return row ? mapRelease(row) : null;
  }

  async list(configId: string): Promise<ConfigRelease[]> {
    const result = await this.db.prepare(
      "SELECT id,config_id,version,status,actor_id,created_at,published_at,rolled_back_at FROM config_releases WHERE config_id=? ORDER BY version DESC"
    ).bind(configId).all<Record<string, unknown>>();
    return result.results.map(mapRelease);
  }

  async publish(configId: string, version: number, actorId: string, now: string): Promise<ConfigRelease> {
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare(
        "UPDATE config_releases SET status='ROLLED_BACK', rolled_back_at=? WHERE config_id=? AND status='PUBLISHED'"
      ).bind(now, configId),
      this.db.prepare(
        "INSERT INTO config_releases (id,config_id,version,status,actor_id,created_at,published_at,rolled_back_at) VALUES (?,?,?,?,?,?,?,NULL) ON CONFLICT(config_id,version) DO UPDATE SET status='PUBLISHED',actor_id=excluded.actor_id,published_at=excluded.published_at,rolled_back_at=NULL"
      ).bind(id, configId, version, "PUBLISHED", actorId, now, now),
      this.db.prepare("UPDATE configs SET published_version=?, updated_at=? WHERE id=?")
        .bind(version, now, configId)
    ]);

    const release = await this.find(configId, version);
    if (!release) throw new Error("release_not_found");
    return release;
  }
}
