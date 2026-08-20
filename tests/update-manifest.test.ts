import { describe, expect, it } from "vitest";

describe("GitHub release update manifest", () => {
  it("builds a Zotero updates.json entry for the tagged GitHub release asset", async () => {
    // @ts-expect-error The release helper is a Node .mjs script without generated declarations.
    const { createUpdateManifest } = await import("../scripts/generate-update-manifest.mjs");
    const manifest = createUpdateManifest({
      addonID: "super-scholar@Kohirus",
      assetName: "super-scholar-0.1.0.xpi",
      repository: "Kohirus/super-scholar",
      sha256: "abc123",
      strictMaxVersion: "9999.*",
      strictMinVersion: "6.999",
      version: "0.1.0",
    });

    expect(manifest).toEqual({
      addons: {
        "super-scholar@Kohirus": {
          updates: [
            {
              version: "0.1.0",
              update_link:
                "https://github.com/Kohirus/super-scholar/releases/download/v0.1.0/super-scholar-0.1.0.xpi",
              update_hash: "sha256:abc123",
              applications: {
                zotero: {
                  strict_min_version: "6.999",
                  strict_max_version: "9999.*",
                },
              },
            },
          ],
        },
      },
    });
  });
});
