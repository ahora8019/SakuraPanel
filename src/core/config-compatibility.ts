import type { GeneratedConfig } from "../models/config";
import type {
  CompatibilityFeature,
  CompatibilityMatrix,
  CompatibilityMatrixEntry,
  CompatibilityMatrixTarget,
  ConfigCompatibility,
  ClientPlatform,
  ClientProtocol
} from "../models/config-compatibility";
import { findClientDefinition } from "./client-compatibility-registry";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];
const FEATURES: readonly CompatibilityFeature[] = ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC", "HTTP2", "QUIC"];

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

function isFeature(value: unknown): value is CompatibilityFeature {
  return typeof value === "string" && FEATURES.includes(value as CompatibilityFeature);
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

  if (value.features !== undefined &&
      (!Array.isArray(value.features) || value.features.length > FEATURES.length || value.features.some(feature => !isFeature(feature)))) {
    errors.push("compatibility_features_invalid");
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

export interface CompatibilityMatrixOptions {
  now?: string;
}

export function evaluateCompatibilityMatrix(
  config: GeneratedConfig,
  target: CompatibilityMatrixTarget
): CompatibilityMatrix {
  const metadata = config.payload.compatibility;
  const validationErrors = validateCompatibilityMetadata(metadata);
  const generatedAt = target && typeof target === "object"
    ? (target as { now?: string }).now ?? new Date().toISOString()
    : new Date().toISOString();

  if (validationErrors.length > 0) {
    return {
      configId: config.id,
      generatedAt,
      entries: target.clients.map(client => ({
        client,
        platform: target.platform,
        protocol: target.protocol,
        status: "unknown",
        reasons: validationErrors,
        supportedFeatures: [],
        unsupportedFeatures: []
      }))
    };
  }

  const entries: CompatibilityMatrixEntry[] = target.clients.map(client => {
    const definition = findClientDefinition(client);
    const reasons: string[] = [];
    const supportedFeatures: CompatibilityFeature[] = [];
    const unsupportedFeatures: CompatibilityFeature[] = [];

    if (!definition) {
      return {
        client,
        platform: target.platform,
        protocol: target.protocol,
        status: "unknown",
        reasons: ["client_unknown"],
        supportedFeatures,
        unsupportedFeatures
      };
    }

    if (!definition.platforms.includes(target.platform)) reasons.push("platform_unsupported");
    if (!definition.protocols.includes(target.protocol)) reasons.push("protocol_unsupported");

    const requiredFeatures = target.features ?? [];
    for (const feature of requiredFeatures) {
      if (definition.features.includes(feature)) supportedFeatures.push(feature);
      else unsupportedFeatures.push(feature);
    }
    if (unsupportedFeatures.length > 0) reasons.push("feature_unsupported");

    const status =
      reasons.includes("platform_unsupported") || reasons.includes("protocol_unsupported")
        ? "incompatible"
        : unsupportedFeatures.length > 0
          ? "partial"
          : "compatible";

    return {
      client,
      platform: target.platform,
      protocol: target.protocol,
      status,
      reasons,
      supportedFeatures,
      unsupportedFeatures
    };
  });

  return { configId: config.id, generatedAt, entries };
}
