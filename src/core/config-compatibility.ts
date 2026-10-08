import type { GeneratedConfig } from "../models/config";
import type { ConfigCompatibility, ClientPlatform, ClientProtocol } from "../models/config-compatibility";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

export function validateCompatibilityMetadata(metadata: unknown): string[] {
  if (metadata === undefined) return [];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ["compatibility_metadata_invalid"];

  const value = metadata as Record<string, unknown>;
  const errors: string[] = [];
  if (!PLATFORMS.includes(value.platform as ClientPlatform)) errors.push("compatibility_platform_invalid");
  if (!PROTOCOLS.includes(value.protocol as ClientProtocol)) errors.push("compatibility_protocol_invalid");

  if (!Array.isArray(value.clients) || value.clients.length === 0 || value.clients.length > 32) {
    errors.push("compatibility_clients_invalid");
  } else if (value.clients.some(client => typeof client !== "string" || !/^[A-Za-z0-9._ -]{1,64}$/.test(client))) {
    errors.push("compatibility_client_name_invalid");
  }

  if (value.minVersion !== undefined && (typeof value.minVersion !== "string" || value.minVersion.length === 0 || value.minVersion.length > 32)) {
    errors.push("compatibility_min_version_invalid");
  }
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) {
    errors.push("compatibility_notes_invalid");
  }

  return errors;
}

export function evaluateCompatibility(config: GeneratedConfig, target: ConfigCompatibility): CompatibilityResult {
  const metadata = config.payload.compatibility;
  const validationErrors = validateCompatibilityMetadata(metadata);
  if (validationErrors.length > 0) return { compatible: false, reasons: validationErrors };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { compatible: false, reasons: ["compatibility_metadata_missing"] };
  }

  const value = metadata as Record<string, unknown>;
  if (value.platform !== target.platform) return { compatible: false, reasons: ["platform_mismatch"] };
  if (value.protocol !== target.protocol) return { compatible: false, reasons: ["protocol_mismatch"] };

  if (target.clients.length > 0) {
    const clients = value.clients as string[];
    if (!target.clients.some(client => clients.includes(client))) return { compatible: false, reasons: ["client_mismatch"] };
  }

  return { compatible: true, reasons: [] };
}
