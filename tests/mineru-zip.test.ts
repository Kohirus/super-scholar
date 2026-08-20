import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractMineruZip } from "../src/mineru/zip";

describe("extractMineruZip", () => {
  it("extracts full Markdown, content list, and asset files", () => {
    const zip = zipSync({
      "paper/full.md": strToU8("# Paper\n\n![figure](images/fig1.png)"),
      "paper/content_list.json": strToU8('[{"type":"text"}]'),
      "paper/images/fig1.png": new Uint8Array([1, 2, 3]),
    });

    const result = extractMineruZip(zip);

    expect(result.markdown).toContain("# Paper");
    expect(result.contentList).toBe('[{"type":"text"}]');
    expect(result.files).toEqual([
      {
        path: "images/fig1.png",
        bytes: new Uint8Array([1, 2, 3]),
      },
    ]);
  });

  it("throws a clear error when the ZIP has no full.md", () => {
    const zip = zipSync({
      "paper/readme.txt": strToU8("missing"),
    });

    expect(() => extractMineruZip(zip)).toThrow("MinerU result ZIP is missing full.md");
  });
});
