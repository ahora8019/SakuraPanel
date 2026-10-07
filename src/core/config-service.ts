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
    if (input.endpointId && input.region) throw new Error("conflicting_endpoint_selection");
    const now = input.now ?? new Date().toISOString();
    if (input.expiresAt && Date.parse(input.expiresAt) <= Date.parse(now)) {
      throw new Error("invalid_expiration");
    }

    let endpointResult: Awaited<ReturnType<EndpointService["get"]>>;
    if (input.endpointId) {
      endpointResult = await this.endpoints.get(input.endpointId);
      if (!endpointResult.ok) throw new Error(endpointResult.error);
    } else {
      const selected = await this.endpoints.select({
        region: input.region,
        maxEndpoints: 1,
        allowDegraded: input.allowDegraded === true
      });
      const endpoint = selected[0];
      if (!endpoint) throw new Error("no_eligible_endpoint");
      endpointResult = { ok: true, value: endpoint };
    }

    const template = await this.templates.findById(input.templateId);
    if (!template) throw new Error("template_not_found");

    const config = this.engine.generate({
      identity: input.identity,
      endpoint: endpointResult.value,
      template,
      expiresAt: input.expiresAt,
      now
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
