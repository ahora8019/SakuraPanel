import type { GeneratedConfig } from "../models/config";
import type { ConfigCompatibility } from "../models/config-compatibility";

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

export function evaluateCompatibility(config: GeneratedConfig, target: ConfigCompatibility): CompatibilityResult {
  const metadata = config.payload.compatibility;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { compatible: false, reasons: ["compatibility_metadata_missing"] };
  }
  const value = metadata as Record<string, unknown>;
  const platform = value.platform;
  const protocol = value.protocol;
  if (platform !== target.platform) return { compatible: false, reasons: ["platform_mismatch"] };
  if (protocol !== target.protocol) return { compatible: false, reasons: ["protocol_mismatch"] };
  if (target.clients.length > 0) {
    const clients = Array.isArray(value.clients) ? value.clients.filter((x): x is string => typeof x === "string") : [];
    if (!target.clients.some(client => clients.includes(client))) return { compatible: false, reasons: ["client_mismatch"] };
  }
  return { compatible: true, reasons: [] };
}
