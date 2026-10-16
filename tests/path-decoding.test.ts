import { describe, expect, it } from "vitest";
import { decodePathSegment } from "../src/index";

describe("safe path segment decoding", () => {
  it("decodes valid percent-encoded identifiers", () => {
    expect(decodePathSegment("user%2D123")).toBe("user-123");
  });

  it("does not throw for malformed percent encoding", () => {
    expect(decodePathSegment("%ZZ")).toBe("");
    expect(decodePathSegment("%E0%A4%A")).toBe("");
  });
});
