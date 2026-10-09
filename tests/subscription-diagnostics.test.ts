import { describe, expect, it } from "vitest";
import { SubscriptionDiagnosticsService } from "../src/core/subscription-diagnostics";
import type { CompatibilityMatrixTarget } from "../src/models/config-compatibility";
import type { Subscription, SubscriptionVersion } from "../src/models/subscription";
import type { GeneratedConfig } from "../src/models/config";
import type { ConfigRepository } from "../src/repositories/config-repository";
import type { SubscriptionRepository } from "../src/repositories/subscription-repository";

class C implements ConfigRepository {
  constructor(private values: GeneratedConfig[]) {}
  async findById(id:string){return this.values.find(x=>x.id===id)??null}
  async listByUserId(id:string){return this.values.filter(x=>x.userId===id)}
  async listByIds(ids:string[]){return ids.map(id=>this.values.find(x=>x.id===id)).filter((x):x is GeneratedConfig=>!!x)}
  async save(){}
  async updateStatus(){return true}
  async getLatestVersion(){return 1}
  async saveVersion(){}
}
class S implements SubscriptionRepository {
  constructor(private sub:Subscription,private ver:SubscriptionVersion|null){}
  async findById(id:string){return id===this.sub.id?this.sub:null}
  async findByPublicTokenHash(){return null}
  async listByUserId(){return [this.sub]}
  async create(){}
  async updatePublicTokenHash(){return true}
  async updateStatus(){return true}
  async getLatestVersion(){return this.ver}
  async saveVersion(){}
}
const sub:Subscription={id:"s1",userId:"u1",status:"ACTIVE",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"};
const cfg=(id:string, status:GeneratedConfig["status"], userId="u1", compatibility?:Record<string, unknown>):GeneratedConfig=>({
  id,userId,templateId:"t",templateVersion:1,payload:compatibility ? { compatibility } : {},status,createdAt:"2026-01-01T00:00:00.000Z"
});

describe("subscription diagnostics",()=>{
 it("reports healthy delivery",async()=>{
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1"],createdAt:"2026-01-01T00:00:00.000Z"};
  const d=await new SubscriptionDiagnosticsService(new S(sub,ver),new C([cfg("c1","ACTIVE")])).inspect("s1","2026-01-01T00:01:00.000Z");
  expect(d.status).toBe("healthy"); expect(d.configs.eligible).toBe(1); expect(d.issues).toEqual([]);
 });
 it("detects inactive, missing and ownership mismatches",async()=>{
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1","c2","missing"],createdAt:"2026-01-01T00:00:00.000Z"};
  const d=await new SubscriptionDiagnosticsService(new S(sub,ver),new C([cfg("c1","REVOKED"),cfg("c2","ACTIVE","other")])).inspect("s1","2026-01-01T00:01:00.000Z");
  expect(d.status).toBe("error"); expect(d.configs.inactive).toBe(1); expect(d.configs.wrongOwner).toBe(1); expect(d.configs.missing).toBe(1);
 });
 it("reports compatibility health for eligible configs",async()=>{
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1"],createdAt:"2026-01-01T00:00:00.000Z"};
  const compatibility={platform:"ANDROID",protocol:"VLESS",clients:["v2rayNG"],features:["TCP","TLS"]};
  const target: CompatibilityMatrixTarget={platform:"ANDROID",protocol:"VLESS",clients:["v2rayNG"],features:["TCP","TLS"]};
  const d=await new SubscriptionDiagnosticsService(new S(sub,ver),new C([cfg("c1","ACTIVE","u1",compatibility)])).inspect("s1","2026-01-01T00:01:00.000Z",target);
  expect(d.status).toBe("healthy");
  expect(d.compatibility).toEqual({checked:1,compatible:1,partial:0,incompatible:0,unknown:0});
 });
 it("marks incompatible configs as an error",async()=>{
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1"],createdAt:"2026-01-01T00:00:00.000Z"};
  const compatibility={platform:"ANDROID",protocol:"VLESS",clients:["v2rayNG"],features:["TCP"]};
  const target={platform:"IOS" as const,protocol:"VLESS" as const,clients:["v2rayNG"]};
  const d=await new SubscriptionDiagnosticsService(new S(sub,ver),new C([cfg("c1","ACTIVE","u1",compatibility)])).inspect("s1","2026-01-01T00:01:00.000Z",target);
  expect(d.status).toBe("error");
  expect(d.compatibility?.incompatible).toBe(1);
  expect(d.issues).toContain("incompatible_configs");
 });
 it("treats malformed subscription expiry as expired like public delivery",async()=>{
  const invalidSub: Subscription={...sub,expiresAt:"not-a-date"};
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1"],createdAt:"2026-01-01T00:00:00.000Z"};
  const d=await new SubscriptionDiagnosticsService(new S(invalidSub,ver),new C([cfg("c1","ACTIVE")])).inspect("s1","2026-01-01T00:01:00.000Z");
  expect(d.subscription.expired).toBe(true);
  expect(d.issues).toContain("subscription_expired");
  expect(d.status).toBe("error");
 });
 it("does not count configs with malformed expiry as eligible",async()=>{
  const ver:SubscriptionVersion={id:"v1",subscriptionId:"s1",version:1,configIds:["c1"],createdAt:"2026-01-01T00:00:00.000Z"};
  const invalidConfig={...cfg("c1","ACTIVE"),expiresAt:"not-a-date"};
  const d=await new SubscriptionDiagnosticsService(new S(sub,ver),new C([invalidConfig])).inspect("s1","2026-01-01T00:01:00.000Z");
  expect(d.configs.eligible).toBe(0);
  expect(d.configs.expired).toBe(1);
  expect(d.issues).toContain("expired_configs");
 });

});
