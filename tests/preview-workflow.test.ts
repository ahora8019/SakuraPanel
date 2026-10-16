import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Preview deployment contract", () => {
  it("applies migrations to the exact isolated D1 database declared by the workflow", () => {
    const workflow = readFileSync(join(process.cwd(), ".github/workflows/preview.yml"), "utf8");

    expect(workflow).toContain('database_name: "sakurapanel-preview-db"');
    expect(workflow).toContain("command: d1 migrations apply sakurapanel-preview-db --remote --config wrangler.preview.jsonc");
    expect(workflow).not.toContain("command: d1 migrations apply sakurapanel-preview --remote --config wrangler.preview.jsonc");
  });
});
