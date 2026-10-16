import type { ClientPlatform, ClientProtocol, CompatibilityFeature } from "../models/config-compatibility";

export interface ClientCompatibilityDefinition {
  id: string;
  name: string;
  platforms: readonly ClientPlatform[];
  protocols: readonly ClientProtocol[];
  features: readonly CompatibilityFeature[];
  minVersion?: string;
}

export const CLIENT_COMPATIBILITY_REGISTRY: readonly ClientCompatibilityDefinition[] = [
  {
    id: "v2rayng",
    name: "v2rayNG",
    platforms: ["ANDROID"],
    protocols: ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS"],
    features: ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC"]
  },
  {
    id: "nekobox",
    name: "NekoBox",
    platforms: ["ANDROID"],
    protocols: ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS"],
    features: ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC"]
  },
  {
    id: "v2box",
    name: "V2Box",
    platforms: ["IOS"],
    protocols: ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS"],
    features: ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC"]
  },
  {
    id: "hiddify",
    name: "Hiddify",
    platforms: ["ANDROID", "IOS", "WINDOWS", "MACOS", "LINUX"],
    protocols: ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS"],
    features: ["TCP", "TLS", "REALITY", "WEBSOCKET", "GRPC"]
  },
  {
    id: "streisand",
    name: "Streisand",
    platforms: ["IOS"],
    protocols: ["VLESS", "VMESS", "TROJAN", "SHADOWSOCKS"],
    features: ["TCP", "TLS", "WEBSOCKET", "GRPC"]
  }
] as const;

export function findClientDefinition(client: string): ClientCompatibilityDefinition | undefined {
  const normalized = client.trim().toLowerCase();
  return CLIENT_COMPATIBILITY_REGISTRY.find(item =>
    item.id === normalized || item.name.toLowerCase() === normalized
  );
}
