import { describe, expect, it } from "vitest";
import { ConfigEngine } from "../src/core/config-engine";
import { validateGeneratedConfig } from "../src/core/config-validation";
import type { Endpoint } from "../src/models/endpoint";
import type { ConfigTemplate } from "../src/models/template";

const endpoint: Endpoint = {
  id: "ep-1",
  name: "Tokyo-01",
  host: "example.invalid",
  port: 443,
  transport: "tls",
  tls: true,
  region: "JP",
  priority: 10,
  status: "HEALTHY",
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z"
};

const template: ConfigTemplate = {
  id: "tpl-1",
  name: "default",
  protocol: "generic",
  version: 1,
  definition: {
    mode: "default"
  },
  status: "ACTIVE",
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z"
};

describe("ConfigEngine", () => {
  it("generates a config from template + endpoint + identity", () => {
    const config = new ConfigEngine().generate({
      identity: { userId: "user-1", deviceId: "device-1" },
      endpoint,
      template,
      expiresAt: "2026-12-01T00:00:00.000Z",
      now: "2026-10-06T00:00:00.000Z"
    });

    expect(config.userId).toBe("user-1");
    expect(config.endpointId).toBe("ep-1");
    expect(config.payload.endpoint.host).toBe("example.invalid");
    expect(validateGeneratedConfig(config).valid).toBe(true);
  });

  it("rejects unavailable endpoints", () => {
    expect(() =>
      new ConfigEngine().generate({
        identity: { userId: "user-1" },
        endpoint: { ...endpoint, status: "DOWN" },
        template
      })
    ).toThrow("endpoint_not_eligible");
  });
});