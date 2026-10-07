import type { ConfigIdentity, GeneratedConfig } from "../models/config";
import type { ConfigRepository } from "../repositories/config-repository";
import { ConfigEngine } from "./config-engine";
import { validateGeneratedConfig } from "./config-validation";
import { EndpointService } from "./endpoint-service";
import type { TemplateRepository } from "../repositories/template-repository";

export class ConfigService {
  constructor(
    private readonly configs: ConfigRepository,
    private readonly endpoints: EndpointService,
    private readonly templates: TemplateRepository,
    private readonly engine = new ConfigEngine()
  ) {}

  async generate(input: {
    identity: ConfigIdentity;
    endpointId?: string;
    region?: string;
    templateId: string;
    allowDegraded?: boolean;
    expiresAt?: string;
    now?: string;
  }): Promise<GeneratedConfig> {
    const endpointResult = await this.endpoints.get(input.endpointId);
    if (!endpointResult.ok) throw new Error(endpointResult.error);

    const template = this.templates.findById(input.templateId);
    if (!template) throw new Error("template_not_found");

    const config = this.engine.generate({
      identity: input.identity,
      endpoint: endpointResult.value,
      template,
      expiresAt: input.expiresAt,
      now: input.now
    });

    const validation = validateGeneratedConfig(config);
    if (!validation.valid) throw new Error(validation.errors.join(","));

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
    if (!["ACTIVE", "EXPIRED", "REVOKED"].includes(status)) {
      throw new Error("validation_failed");
    }
    if (!(await this.configs.updateStatus(id, status, now))) throw new Error("not_found");
    return this.get(id);
  }
}
