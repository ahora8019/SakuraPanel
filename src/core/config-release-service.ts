import type { ConfigRelease } from "../models/config-release";
import type { ConfigRepository } from "../repositories/config-repository";
import type { ConfigReleaseRepository } from "../repositories/config-release-repository";
import type { UserRepository } from "../repositories/user-repository";
import type { AuditSink } from "../security/audit";
import { createAuditEvent } from "../security/audit";

export class ConfigReleaseService {
  constructor(
    private readonly configs: ConfigRepository,
    private readonly releases: ConfigReleaseRepository,
    private readonly users?: UserRepository,
    private readonly audit?: AuditSink
  ) {}

  async getConfigOwner(configId: string): Promise<string> {
    const config = await this.configs.findById(configId);
    if (!config) throw new Error("not_found");
    return config.userId;
  }

  async list(configId: string): Promise<ConfigRelease[]> {
    return this.releases.list(configId);
  }

  async publish(configId: string, version: number, actorId: string, now = new Date().toISOString()): Promise<ConfigRelease> {
    await this.assertActor(actorId);
    await this.assertVersion(configId, version);
    const release = await this.releases.publish(configId, version, actorId, now);
    await this.writeAudit("PUBLISH", configId, version, actorId, now);
    return release;
  }

  async rollback(configId: string, version: number, actorId: string, now = new Date().toISOString()): Promise<ConfigRelease> {
    await this.assertActor(actorId);
    await this.assertVersion(configId, version);
    const release = await this.releases.publish(configId, version, actorId, now);
    await this.writeAudit("ROLLBACK", configId, version, actorId, now);
    return release;
  }

  private async assertActor(actorId: string): Promise<void> {
    if (!actorId) throw new Error("validation_failed");
    if (this.users) {
      const actor = await this.users.findById(actorId);
      if (!actor || actor.status !== "ACTIVE") throw new Error("user_not_active");
    }
  }

  private async assertVersion(configId: string, version: number): Promise<void> {
    if (!Number.isInteger(version) || version < 1) throw new Error("validation_failed");
    const config = await this.configs.findById(configId);
    if (!config) throw new Error("not_found");
    if (!this.configs.getVersionPayload) throw new Error("service_not_configured");
    const payload = await this.configs.getVersionPayload(configId, version);
    if (!payload) throw new Error("version_not_found");
  }

  private async writeAudit(action: "PUBLISH" | "ROLLBACK", configId: string, version: number, actorId: string, now: string): Promise<void> {
    if (!this.audit) return;
    await this.audit.write(createAuditEvent({
      actorId,
      action: action === "PUBLISH" ? "UPDATE" : "REVOKE",
      resource: "config_release",
      resourceId: configId,
      metadata: { version: String(version), releaseAction: action }
    }, now));
  }
}
