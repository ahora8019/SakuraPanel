import { describe, expect, it } from "vitest";
import type { GeneratedConfig } from "../src/models/config";
import { exportConfigs, inspectConfig, rankRoutes, timeBounded } from "../src/core/v1-systems";

function config(overrides: Partial<GeneratedConfig> = {}): GeneratedConfig {
  return {
    id: "cfg-1",
    userId: "user-1",
    templateId: "template-1",
    templateVersion: 1,
    payload: { uri: "vless://abc@example.com:443?security=tls", label: "東京" },
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides
  };
}

describe("Config Studio", () => {
  it("serializes valid JSON deterministically and excludes internal user identity", () => {
    const result = exportConfigs([config()], "json", "2026-10-02T00:00:00.000Z");
    expect(result.count).toBe(1);
    expect(result.contentType).toContain("application/json");
    const decoded = JSON.parse(result.body);
    expect(decoded[0].payload.label).toBe("東京");
    expect(decoded[0].userId).toBeUndefined();
  });

  it("filters expired and revoked configs", () => {
    const result = exportConfigs([
      config({ id: "expired", expiresAt: "2026-09-01T00:00:00.000Z" }),
      config({ id: "revoked", status: "REVOKED" }),
      config({ id: "active" })
    ], "json", "2026-10-02T00:00:00.000Z");
    expect(result.count).toBe(1);
    expect(result.excluded.expired).toBe(1);
    expect(result.excluded.disabled).toBe(1);
  });

  it("excludes sensitive payloads instead of redacting protocol data", () => {
    const result = exportConfigs([config({ payload: { uri: "vless://secret@example.com:443", private_key: "do-not-export" } })], "json");
    expect(result.count).toBe(0);
    expect(result.excluded.sensitive).toBe(1);
    expect(result.body).not.toContain("do-not-export");
  });

  it("exports existing recognized links without rewriting them", () => {
    const uri = "vless://abc@example.com:443?security=tls";
    const result = exportConfigs([config({ payload: { uri } })], "links");
    expect(result.body).toBe(uri);
    expect(result.count).toBe(1);
  });

  it("uses UTF-8 standard Base64 for subscription line lists and round-trips Unicode", () => {
    const uri = "vless://abc@example.com:443?remarks=東京";
    const result = exportConfigs([config({ payload: { uri } })], "subscription");
    const binary = atob(result.body);
    const decoded = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    expect(decoded).toBe(uri);
  });

  it("rejects malformed configs and unsupported formats", () => {
    expect(inspectConfig(config({ templateVersion: 0 })).state).toBe("invalid");
    expect(() => exportConfigs([], "yaml" as never)).toThrow("unsupported_export_format");
  });
});

describe("Sakura Speed Lab and Route Advisor", () => {
  it("reports a bounded successful timing sample", async () => {
    const result = await timeBounded(async () => 7, 100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(7);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns timeout instead of pretending an operation succeeded", async () => {
    const result = await timeBounded(() => new Promise<number>(() => {}), 5);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns insufficient data when no routes have evidence", () => {
    expect(rankRoutes([]).decision).toBe("insufficient_data");
  });

  it("ranks fresh healthy compatible candidates and rejects stale or unhealthy evidence", () => {
    const now = "2026-10-09T12:00:00.000Z";
    const result = rankRoutes([
      { id: "slow", compatible: true, healthy: true, latencyMs: 500, errorRate: 0.01, sampleCount: 5, measuredAt: "2026-10-09T11:59:00.000Z" },
      { id: "fast", compatible: true, healthy: true, latencyMs: 50, errorRate: 0, sampleCount: 5, measuredAt: "2026-10-09T11:59:00.000Z" },
      { id: "stale", compatible: true, healthy: true, latencyMs: 1, errorRate: 0, sampleCount: 5, measuredAt: "2026-10-09T10:00:00.000Z" },
      { id: "down", compatible: true, healthy: false, latencyMs: 5, errorRate: 1, sampleCount: 5, measuredAt: "2026-10-09T11:59:00.000Z" }
    ], now);
    expect(result.decision).toBe("recommendation");
    expect(result.candidates[0].id).toBe("fast");
    expect(result.candidates.find(x => x.id === "stale")?.score).toBeNull();
    expect(result.candidates.find(x => x.id === "down")?.score).toBeNull();
  });
});
