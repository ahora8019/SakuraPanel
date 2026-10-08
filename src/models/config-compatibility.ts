export type ClientPlatform = "ANDROID" | "IOS" | "WINDOWS" | "MACOS" | "LINUX" | "OTHER";
export type ClientProtocol = "VLESS" | "VMESS" | "TROJAN" | "SHADOWSOCKS" | "OTHER";

export type CompatibilityFeature =
  | "TCP"
  | "TLS"
  | "REALITY"
  | "WEBSOCKET"
  | "GRPC"
  | "HTTP2"
  | "QUIC";

export type CompatibilityStatus = "compatible" | "partial" | "incompatible" | "unknown";

export interface ConfigCompatibility {
  platform: ClientPlatform;
  protocol: ClientProtocol;
  clients: string[];
  features?: CompatibilityFeature[];
  minVersion?: string;
  notes?: string;
}

export interface CompatibilityMatrixTarget extends ConfigCompatibility {
  clientVersion?: string;
}

export interface CompatibilityMatrixEntry {
  client: string;
  platform: ClientPlatform;
  protocol: ClientProtocol;
  status: CompatibilityStatus;
  reasons: string[];
  supportedFeatures: CompatibilityFeature[];
  unsupportedFeatures: CompatibilityFeature[];
}

export interface CompatibilityMatrix {
  configId: string;
  generatedAt: string;
  entries: CompatibilityMatrixEntry[];
}
