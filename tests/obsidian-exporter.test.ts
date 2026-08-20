import { describe, expect, it, vi } from "vitest";
import { buildHashedPdfName, createObsidianExporter, rewriteMarkdownAssetLinks } from "../src/obsidianExporter";
import type { MineruParseResult } from "../src/types/mineru";

describe("Obsidian exporter", () => {
  it("creates numbered directories when a paper directory already exists", async () => {
    const directories = new Set(["D:/Vault/Paper", "D:/Vault/Paper-2"]);
    const writes = new Map<string, string | Uint8Array>();
    const exporter = createObsidianExporter({
      fs: {
        exists: vi.fn(async (path) => directories.has(path)),
        mkdir: vi.fn(async (path) => {
          directories.add(path);
        }),
        readBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
        writeBytes: vi.fn(async (path, value) => {
          writes.set(path, value);
        }),
        writeText: vi.fn(async (path, value) => {
          writes.set(path, value);
        }),
      },
    });
    const mineru: MineruParseResult = {
      markdown: "![fig](images/fig.png)",
      contentList: null,
      files: [{ path: "images/fig.png", bytes: new Uint8Array([9]) }],
    };

    const result = await exporter.exportPaper({
      notesRoot: "D:/Vault",
      folderTitle: "Paper",
      sourcePdfPath: "D:/input/source.pdf",
      mineru,
    });

    expect(result.paperDir).toBe("D:/Vault/Paper-3");
    expect(result.pdfPath).toBe("D:/Vault/Paper-3/paper-039058c6f2c0cb49.pdf");
    expect(writes.get("D:/Vault/Paper-3/原文解析.md")).toBe("![fig](assets/images/fig.png)");
    expect(writes.has("D:/Vault/Paper-3/阅读笔记.md")).toBe(false);
    expect(writes.get("D:/Vault/Paper-3/assets/images/fig.png")).toEqual(new Uint8Array([9]));
  });

  it("builds stable hashed PDF names from bytes", async () => {
    await expect(buildHashedPdfName(new Uint8Array([1, 2, 3]))).resolves.toBe("paper-039058c6f2c0cb49.pdf");
  });

  it("rewrites common Markdown asset links into the assets folder", () => {
    expect(rewriteMarkdownAssetLinks("![a](images/a.png)\n[doc](tables/t.csv)")).toBe(
      "![a](assets/images/a.png)\n[doc](assets/tables/t.csv)",
    );
  });
});
