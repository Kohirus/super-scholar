import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

  it("packages the supplied Super Scholar icon at the existing add-on icon path", () => {
    const root = resolve(import.meta.dirname, "..");
    execFileSync(process.execPath, [resolve(root, "scripts", "build.mjs")], { cwd: root });

    expect(readFileSync(resolve(root, "dist", "addon", "content", "icons", "logo.svg"), "utf8")).toBe(
      readFileSync(resolve(root, "assets", "Super-Scholar-icon.svg"), "utf8"),
    );
    expect(
      JSON.parse(readFileSync(resolve(root, "dist", "addon", "_locales", "en", "messages.json"), "utf8")),
    ).toHaveProperty("extensionDescription.message");
    expect(
      JSON.parse(readFileSync(resolve(root, "dist", "addon", "_locales", "zh_CN", "messages.json"), "utf8")),
    ).toHaveProperty("extensionDescription.message");
  });

  it("uses the supplied Super Scholar logo in both README files", () => {
    const root = resolve(import.meta.dirname, "..");
    for (const filename of ["README.md", "README.zh-CN.md"]) {
      expect(readFileSync(resolve(root, filename), "utf8")).toContain(
        '<img src="./assets/Super-Scholar-logo.svg"',
      );
    }
  });
});
