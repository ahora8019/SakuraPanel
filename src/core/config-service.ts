import type { ConfigIdentity, GeneratedConfig } from "../models/config";
import type { ConfigRepository } from "../repositories/config-repository";
import { ConfigEngine } from "./config-engine";
import { validateGeneratedConfig } from "./config-validation";
import type { TemplateRepository } from "../repositories/template-repository";
import type { DeviceRepository } from "../repositories/device-repository";
import type { UserRepository } from "../repositories/user-repository";

export class ConfigService {
  constructor(
    private readonly configs: ConfigRepository,
    private readonly templates: TemplateRepository,
    private readonly engine = new ConfigEngine(),
    private readonly devices?: DeviceRepository,
    private readonly users?: UserRepository
  ) {}

  async generate(input: {
    identity: ConfigIdentity;
    templateId: string;
    expiresAt?: string;
    now?: string;
  }): Promise<GeneratedConfig> {
    if (!input.identity.userId || !input.templateId) throw new Error("validation_failed");

    if (this.users) {
      const user = await this.users.findById(input.identity.userId);
      if (!user || user.status !== "ACTIVE") throw new Error("user_not_active");
    }

    const now = input.now ?? new Date().toISOString();
    const nowMs = Date.parse(now);
    if (Number.isNaN(nowMs)) throw new Error("invalid_timestamp");

    if (input.expiresAt) {
      const expiresMs = Date.parse(input.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) throw new Error("invalid_expiration");
    }

    if (input.identity.deviceId) {
      if (!this.devices) throw new Error("service_not_configured");
      const device = await this.devices.findById(input.identity.deviceId);
      if (!device || device.userId !== input.identity.userId || device.status !== "ACTIVE") {
        throw new Error("device_not_owned");
      }
    }

    const template = await this.templates.findById(input.templateId);
    if (!template) throw new Error("template_not_found");

    const config = this.engine.generate({
      identity: input.identity,
      template,
      expiresAt: input.expiresAt,
      now
    });

    const validation = validateGeneratedConfig(config);
    if (!validation.valid) throw new Error("validation_failed");

    await this.configs.save(config);
    return config;
  }

  async get(id: string): Promise<GeneratedConfig> {
    const config = await this.configs.findById(id);
    if (!config) throw new Error("not_found");
    return config;
  }

  async listByUserId(userId: string): Promise<GeneratedConfig[]> {
    return this.configs.listByUserId(userId);
  }

  async updateStatus(id: string, status: GeneratedConfig["status"], now: string): Promise<GeneratedConfig> {
    if (!["ACTIVE", "EXPIRED", "REVOKED"].includes(status)) throw new Error("validation_failed");
    const current = await this.configs.findById(id);
    if (!current) throw new Error("not_found");
    if (current.status === "REVOKED" && status === "ACTIVE") {
      throw new Error("config_revoked_terminal");
    }
    if (!(await this.configs.updateStatus(id, status, now))) {
      const latest = await this.configs.findById(id);
      if (!latest) throw new Error("not_found");
      if (latest.status === "REVOKED" && status === "ACTIVE") throw new Error("config_revoked_terminal");
      throw new Error("not_found");
    }
    return this.get(id);
  }
}
