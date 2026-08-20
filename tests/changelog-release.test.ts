import { describe, expect, it } from "vitest";

describe("changelog release helpers", () => {
  it("extracts release notes for the requested version from the root CHANGELOG", async () => {
    // @ts-expect-error The release helper is a Node .mjs script without generated declarations.
    const { extractReleaseNotes } = await import("../scripts/extract-changelog.mjs");

    const notes = extractReleaseNotes(`# Changelog

## 0.2.0

- Newer change.

## 0.1.0

- Publish plugin.
- Add CI release.

## 0.0.9

- Older change.
`, "0.1.0");

    expect(notes).toBe("- Publish plugin.\n- Add CI release.");
  });

  it("checks package, manifest, and changelog versions together", async () => {
    // @ts-expect-error The release helper is a Node .mjs script without generated declarations.
    const { checkReleaseDiscipline } = await import("../scripts/check-release-discipline.mjs");

    expect(() =>
      checkReleaseDiscipline({
        basePackageJson: { version: "0.0.9" },
        currentPackageJson: { version: "0.1.0" },
        currentManifest: { version: "0.1.0" },
        changelog: "# Changelog\n\n## 0.1.0\n\n- Publish plugin.\n",
      }),
    ).not.toThrow();
  });

  it("allows initial release checks when no base package exists", async () => {
    // @ts-expect-error The release helper is a Node .mjs script without generated declarations.
    const { checkReleaseDiscipline } = await import("../scripts/check-release-discipline.mjs");

    expect(() =>
      checkReleaseDiscipline({
        basePackageJson: null,
        currentPackageJson: { version: "0.1.0" },
        currentManifest: { version: "0.1.0" },
        changelog: "# Changelog\n\n## 0.1.0\n\n- Publish plugin.\n",
      }),
    ).not.toThrow();
  });

  it("rejects PRs that change version without a matching changelog entry", async () => {
    // @ts-expect-error The release helper is a Node .mjs script without generated declarations.
    const { checkReleaseDiscipline } = await import("../scripts/check-release-discipline.mjs");

    expect(() =>
      checkReleaseDiscipline({
        basePackageJson: { version: "0.0.9" },
        currentPackageJson: { version: "0.1.0" },
        currentManifest: { version: "0.1.0" },
        changelog: "# Changelog\n\n## 0.0.9\n\n- Old release.\n",
      }),
    ).toThrow(/CHANGELOG/);
  });
});
