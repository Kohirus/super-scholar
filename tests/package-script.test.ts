import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("XPI package script", () => {
  it("writes manifest.json first and stores entries without compression", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "..", "scripts", "package.mjs"),
      "utf8",
    );

    expect(script).toContain("MANIFEST_FIRST_FILES");
    expect(script).toContain("rm(packageDir");
    expect(script).toContain("level: 0");
    expect(script).toContain("packageJson.name");
  });
});
