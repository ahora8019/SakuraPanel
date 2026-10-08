import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "../src/core/config-compatibility";
import type { GeneratedConfig } from "../src/models/config";

const config: GeneratedConfig = {
  id:"c1", userId:"u1", templateId:"t1", templateVersion:1, status:"ACTIVE",
  createdAt:"2026-01-01T00:00:00.000Z",
  payload:{compatibility:{platform:"ANDROID",protocol:"VLESS",clients:["v2rayNG","NekoBox"]}}
};

describe("config compatibility",()=>{
  it("accepts a matching client",()=>{
    expect(evaluateCompatibility(config,{platform:"ANDROID",protocol:"VLESS",clients:["v2rayNG"]}).compatible).toBe(true);
  });
  it("rejects platform/protocol/client mismatch",()=>{
    expect(evaluateCompatibility(config,{platform:"IOS",protocol:"VLESS",clients:["v2rayNG"]}).reasons).toContain("platform_mismatch");
    expect(evaluateCompatibility(config,{platform:"ANDROID",protocol:"TROJAN",clients:["v2rayNG"]}).reasons).toContain("protocol_mismatch");
    expect(evaluateCompatibility(config,{platform:"ANDROID",protocol:"VLESS",clients:["Streisand"]}).reasons).toContain("client_mismatch");
  });
});
