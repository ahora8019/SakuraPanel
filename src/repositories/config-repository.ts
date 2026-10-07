import type { GeneratedConfig, ConfigStatus } from "../models/config";

export interface ConfigRepository {
  findById(id: string): Promise<GeneratedConfig | null>;
  listByUserId(userId: string): Promise<GeneratedConfig[]>;
  save(config: GeneratedConfig): Promise<void>;
  updateStatus(id: string, status: ConfigStatus, updatedAt: string): Promise<boolean>;
  getLatestVersion(configId: string): Promise<number>;
  saveVersion(configId: string, version: number, payload: Record<string, unknown>, createdAt: string): Promise<void>;
}

function mapConfig(row: Record<string, unknown>): GeneratedConfig {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.payload ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch {
    payload = {};
  }

  return {
    id: String(row.id),
    userId: String(row.user_id),
    deviceId: row.device_id == null ? undefined : String(row.device_id),
    endpointId: String(row.endpoint_id),
    templateId: String(row.template_id),
    templateVersion: Number(row.template_version ?? 1),
    payload,
    status: row.status as ConfigStatus,
    expiresAt: row.expires_at == null ? undefined : String(row.expires_at),
    createdAt: String(row.created_at)
  };
}

export class D1ConfigRepository implements ConfigRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<GeneratedConfig | null> {
    const row = await this.db.prepare(
      "SELECT c.id,c.user_id,c.device_id,c.endpoint_id,c.template_id,c.template_version,c.status,c.expires_at,c.created_at,c.updated_at,cv.version AS config_version,cv.payload FROM configs c LEFT JOIN config_versions cv ON cv.config_id=c.id AND cv.version=(SELECT MAX(v.version) FROM config_versions v WHERE v.config_id=c.id) WHERE c.id=?"
    ).bind(id).first<Record<string, unknown>>();
    return row ? mapConfig(row) : null;
  }

  async listByUserId(userId: string): Promise<GeneratedConfig[]> {
    const result = await this.db.prepare(
      "SELECT c.id,c.user_id,c.device_id,c.endpoint_id,c.template_id,c.template_version,c.status,c.expires_at,c.created_at,c.updated_at,cv.version AS config_version,cv.payload FROM configs c LEFT JOIN config_versions cv ON cv.config_id=c.id AND cv.version=(SELECT MAX(v.version) FROM config_versions v WHERE v.config_id=c.id) WHERE c.user_id=? ORDER BY c.created_at DESC"
    ).bind(userId).all<Record<string, unknown>>();
    return result.results.map(mapConfig);
  }

  async save(config: GeneratedConfig): Promise<void> {
    await this.db.prepare(`INSERT INTO configs
      (id,user_id,device_id,endpoint_id,template_id,template_version,status,expires_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      config.id, config.userId, config.deviceId ?? null, config.endpointId,
      config.templateId, config.templateVersion, config.status, config.expiresAt ?? null,
      config.createdAt, config.createdAt
    ).run();

    await this.saveVersion(config.id, 1, config.payload, config.createdAt);
  }

  async updateStatus(id: string, status: ConfigStatus, updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE configs SET status=?, updated_at=? WHERE id=?"
    ).bind(status, updatedAt, id).run();
    return result.meta.changes > 0;
  }

  async getLatestVersion(configId: string): Promise<number> {
    const row = await this.db.prepare(
      "SELECT COALESCE(MAX(version),0) AS version FROM config_versions WHERE config_id=?"
    ).bind(configId).first<{version:number}>();
    return Number(row?.version ?? 0);
  }

  async saveVersion(
    configId: string,
    version: number,
    payload: Record<string, unknown>,
    createdAt: string
  ): Promise<void> {
    await this.db.prepare(
      "INSERT INTO config_versions (id,config_id,version,payload,created_at) VALUES (?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(), configId, version, JSON.stringify(payload), createdAt
    ).run();
  }
}
