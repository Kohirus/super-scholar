import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("GitHub Actions workflows", () => {
  it("runs PR checks for main without uploading release artifacts", () => {
    const workflow = readFileSync(resolve(root, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("main");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run check:release-discipline");
    expect(workflow).not.toContain("actions/upload-artifact");
  });

  it("publishes main branch pushes with generated tags, artifacts, and changelog notes", () => {
    const workflow = readFileSync(resolve(root, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("main");
    expect(workflow).toContain("npm run package");
    expect(workflow).toContain("npm run release:notes");
    expect(workflow).toContain("npm run release:manifest");
    expect(workflow).toContain("git tag");
    expect(workflow).toContain("git push origin");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("dist/package/updates.json");
    expect(workflow).toContain("--notes-file dist/package/release-notes.md");
    expect(workflow).toContain("actions/upload-artifact@v7");
  });
});
