import type {
  ClientPlatform,
  ClientProtocol,
  CompatibilityFeature,
  CompatibilityMatrixTarget
} from "../models/config-compatibility";

const PLATFORMS: readonly ClientPlatform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX", "OTHER"];
const PROTOCOLS: readonly ClientProtocol[] = ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS", "OTHER"];
const FEATURES: readonly CompatibilityFeature[] = ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC", "HTTP2", "QUIC"];
const ALLOWED_KEYS = new Set(["platform", "protocol", "client", "feature"]);

/**
 * Parse compatibility query parameters consistently across private and public APIs.
 * Reject unknown fields and duplicate scalar/list values instead of silently
 * accepting ambiguous requests.
 */
export function parseCompatibilityTarget(params: URLSearchParams): CompatibilityMatrixTarget {
  for (const key of params.keys()) {
    if (!ALLOWED_KEYS.has(key)) throw new Error("validation_failed");
  }

  const platformValues = params.getAll("platform");
  const protocolValues = params.getAll("protocol");
  const clients = params.getAll("client");
  const features = params.getAll("feature");
  const platform = platformValues[0];
  const protocol = protocolValues[0];

  if (
    platformValues.length !== 1 ||
    protocolValues.length !== 1 ||
    !PLATFORMS.includes(platform as ClientPlatform) ||
    !PROTOCOLS.includes(protocol as ClientProtocol) ||
    clients.length === 0 ||
    clients.length > 32 ||
    new Set(clients).size !== clients.length ||
    clients.some(client => !/^[A-Za-z0-9._ -]{1,64}$/.test(client)) ||
    features.length > FEATURES.length ||
    new Set(features).size !== features.length ||
    features.some(feature => !FEATURES.includes(feature as CompatibilityFeature))
  ) {
    throw new Error("validation_failed");
  }

  return {
    platform: platform as ClientPlatform,
    protocol: protocol as ClientProtocol,
    clients,
    ...(features.length > 0 ? { features: features as CompatibilityFeature[] } : {})
  };
}
