import type { ConfigTemplate } from "../models/template";

export interface TemplateRepository {
  findById(id: string): Promise<ConfigTemplate | null>;
  list(status?: ConfigTemplate["status"]): Promise<ConfigTemplate[]>;
  save(template: ConfigTemplate): Promise<void>;
  updateStatus(id: string, status: ConfigTemplate["status"], updatedAt: string): Promise<boolean>;
}

function map(row: Record<string, unknown>): ConfigTemplate {
  let definition: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.definition_json ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) definition = parsed;
  } catch {}
  return {
    id: String(row.id),
    name: String(row.name),
    protocol: String(row.protocol),
    version: Number(row.version),
    definition,
    status: row.status as ConfigTemplate["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class D1TemplateRepository implements TemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<ConfigTemplate | null> {
    const row = await this.db.prepare("SELECT * FROM templates WHERE id=?").bind(id).first<Record<string, unknown>>();
    return row ? map(row) : null;
  }

  async list(status?: ConfigTemplate["status"]): Promise<ConfigTemplate[]> {
    const result = status
      ? await this.db.prepare("SELECT * FROM templates WHERE status=? ORDER BY name").bind(status).all<Record<string, unknown>>()
      : await this.db.prepare("SELECT * FROM templates ORDER BY name").all<Record<string, unknown>>();
    return result.results.map(map);
  }

  async save(template: ConfigTemplate): Promise<void> {
    await this.db.prepare(
      "INSERT INTO templates (id,name,protocol,version,definition_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      template.id, template.name, template.protocol, template.version,
      JSON.stringify(template.definition), template.status, template.createdAt, template.updatedAt
    ).run();
  }

  async updateStatus(id: string, status: ConfigTemplate["status"], updatedAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE templates SET status=?, updated_at=? WHERE id=?"
    ).bind(status, updatedAt, id).run();
    return result.meta.changes > 0;
  }
}
