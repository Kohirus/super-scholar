import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("package and add-on versions", () => {
  it("keeps package.json and manifest.json on the same release version", () => {
    const root = resolve(import.meta.dirname, "..");
    const packageJson = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    );
    const manifest = JSON.parse(
      readFileSync(resolve(root, "manifest.json"), "utf8"),
    );
    const changelog = readFileSync(resolve(root, "CHANGELOG"), "utf8");

    expect(packageJson.name).toBe("super-scholar");
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.version).toBe(packageJson.version);
    expect(changelog).toContain(`## ${packageJson.version}`);
  });
});
