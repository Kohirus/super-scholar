import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Zotero compatibility manifest", () => {
  it("declares the super-scholar plugin identity, author, compatibility range, and icons", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "..", "manifest.json"), "utf8"),
    );

    expect(manifest.name).toBe("super-scholar");
    expect(manifest.author).toBe("Kohirus");
    expect(manifest.applications.zotero.id).toBe("super-scholar@Kohirus");
    expect(manifest.applications.zotero.strict_min_version).toBe("6.999");
    expect(manifest.applications.zotero.strict_max_version).toBe("9999.*");
    expect(manifest.applications.zotero.update_url).toBe(
      "https://github.com/Kohirus/super-scholar/releases/latest/download/updates.json",
    );
    expect(manifest.icons).toEqual({
      "16": "content/icons/logo.svg",
      "32": "content/icons/logo.svg",
      "48": "content/icons/logo.svg",
      "96": "content/icons/logo.svg",
    });
  });
});
