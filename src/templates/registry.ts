import type { ConfigTemplate } from "../models/template";

export class TemplateRegistry {
  private readonly templates = new Map<string, ConfigTemplate>();

  register(template: ConfigTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error("template_already_exists");
    }
    this.templates.set(template.id, template);
  }

  get(id: string): ConfigTemplate | null {
    return this.templates.get(id) ?? null;
  }

  listActive(): ConfigTemplate[] {
    return [...this.templates.values()].filter(
      template => template.status === "ACTIVE"
    );
  }
}