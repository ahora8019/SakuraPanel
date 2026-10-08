export type ClientPlatform = "ANDROID" | "IOS" | "WINDOWS" | "MACOS" | "LINUX" | "OTHER";
export type ClientProtocol = "VLESS" | "VMESS" | "TROJAN" | "SHADOWSOCKS" | "OTHER";

export interface ConfigCompatibility {
  platform: ClientPlatform;
  protocol: ClientProtocol;
  clients: string[];
  minVersion?: string;
  notes?: string;
}
