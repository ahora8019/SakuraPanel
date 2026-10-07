import type { ConfigTemplate } from "../models/template";
import type { TemplateRepository } from "../repositories/template-repository";

export class TemplateService {
  constructor(private readonly templates: TemplateRepository) {}

  async get(id: string): Promise<ConfigTemplate> {
    const template = await this.templates.findById(id);
    if (!template) throw new Error("not_found");
    return template;
  }

  async list(status?: ConfigTemplate["status"]): Promise<ConfigTemplate[]> {
    return this.templates.list(status);
  }

  async create(input: {
    name: string;
    protocol: string;
    version?: number;
    definition: Record<string, unknown>;
    status?: ConfigTemplate["status"];
  }): Promise<ConfigTemplate> {
    const name = input.name.trim();
    const protocol = input.protocol.trim();
    if (!name || name.length > 128 || !protocol || protocol.length > 32) {
      throw new Error("validation_failed");
    }
    if (!Number.isInteger(input.version ?? 1) || (input.version ?? 1) < 1) {
      throw new Error("validation_failed");
    }
    if (!input.definition || typeof input.definition !== "object" || Array.isArray(input.definition)) {
      throw new Error("validation_failed");
    }

    const now = new Date().toISOString();
    const template: ConfigTemplate = {
      id: crypto.randomUUID(),
      name,
      protocol,
      version: input.version ?? 1,
      definition: input.definition,
      status: input.status ?? "ACTIVE",
      createdAt: now,
      updatedAt: now
    };

    if (await this.templates.list().then(items => items.some(item => item.name === name))) {
      throw new Error("conflict");
    }

    await this.templates.save(template);
    return template;
  }

  async updateStatus(id: string, status: ConfigTemplate["status"]): Promise<ConfigTemplate> {
    if (!["ACTIVE", "DISABLED", "RETIRED"].includes(status)) {
      throw new Error("validation_failed");
    }
    if (!(await this.templates.updateStatus(id, status, new Date().toISOString()))) {
      throw new Error("not_found");
    }
    return this.get(id);
  }
}
