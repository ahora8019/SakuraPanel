import type { GeneratedConfig } from "../models/config";
import type { ConfigCompatibility, ClientPlatform, ClientProtocol } from "../models/config-compatibility";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

export function validateCompatibilityMetadata(value: unknown): string[] {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["compatibility_metadata_invalid"];

  const metadata = value as Record<string, unknown>;
  const errors: string[] = [];

  if (!PLATFORMS.includes(metadata.platform as ClientPlatform)) errors.push("compatibility_platform_invalid");
  if (!PROTOCOLS.includes(metadata.protocol as ClientProtocol)) errors.push("compatibility_protocol_invalid");

  if (!Array.isArray(metadata.clients) || metadata.clients.length > 32) {
    errors.push("compatibility_clients_invalid");
  } else if (metadata.clients.some(client => typeof client !== "string" || client.length < 1 || client.length > 64)) {
    errors.push("compatibility_clients_invalid");
  }

  if (metadata.minVersion !== undefined &&
      (typeof metadata.minVersion !== "string" || metadata.minVersion.length < 1 || metadata.minVersion.length > 64)) {
    errors.push("compatibility_min_version_invalid");
  }

  if (metadata.notes !== undefined &&
      (typeof metadata.notes !== "string" || metadata.notes.length > 500)) {
    errors.push("compatibility_notes_invalid");
  }

  return errors;
}

export function evaluateCompatibility(config: GeneratedConfig, target: ConfigCompatibility): CompatibilityResult {
  const metadata = config.payload.compatibility;
  const metadataErrors = validateCompatibilityMetadata(metadata);
  if (metadataErrors.length > 0) {
    return { compatible: false, reasons: metadataErrors };
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { compatible: false, reasons: ["compatibility_metadata_missing"] };
  }

  const value = metadata as Record<string, unknown>;
  if (value.platform !== target.platform) return { compatible: false, reasons: ["platform_mismatch"] };
  if (value.protocol !== target.protocol) return { compatible: false, reasons: ["protocol_mismatch"] };

  if (target.clients.length > 0) {
    const clients = Array.isArray(value.clients)
      ? value.clients.filter((x): x is string => typeof x === "string")
      : [];
    if (!target.clients.some(client => clients.includes(client))) {
      return { compatible: false, reasons: ["client_mismatch"] };
    }
  }

  return { compatible: true, reasons: [] };
}
