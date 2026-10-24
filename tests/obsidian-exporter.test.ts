import { describe, expect, it, vi } from "vitest";
import { buildHashedPdfName, createObsidianExporter, rewriteMarkdownAssetLinks } from "../src/obsidianExporter";
import type { MineruParseResult } from "../src/types/mineru";
import { UiError } from "../src/i18n";

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

  it("preserves the leading slash in absolute POSIX output paths", async () => {
    const checkedPaths: string[] = [];
    const createdPaths: string[] = [];
    const writtenPaths: string[] = [];
    const exporter = createObsidianExporter({
      fs: {
        exists: vi.fn(async (path) => {
          checkedPaths.push(path);
          return false;
        }),
        mkdir: vi.fn(async (path) => {
          createdPaths.push(path);
        }),
        readBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
        writeBytes: vi.fn(async (path) => {
          writtenPaths.push(path);
        }),
        writeText: vi.fn(async (path) => {
          writtenPaths.push(path);
        }),
      },
    });

    const result = await exporter.exportPaper({
      notesRoot: "/Users/kohirus/Obsidian/Zotero Notes",
      folderTitle: "FlowVLA",
      sourcePdfPath: "/Users/kohirus/Zotero/storage/source.pdf",
      mineru: {
        markdown: "![figure](images/figure.png)",
        contentList: null,
        files: [{ path: "images/figure.png", bytes: new Uint8Array([9]) }],
      },
    });

    expect(checkedPaths).toEqual(["/Users/kohirus/Obsidian/Zotero Notes/FlowVLA"]);
    expect(createdPaths).toEqual([
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA",
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA/assets",
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA/assets/images",
    ]);
    expect(writtenPaths).toEqual([
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA/paper-039058c6f2c0cb49.pdf",
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA/assets/images/figure.png",
      "/Users/kohirus/Obsidian/Zotero Notes/FlowVLA/原文解析.md",
    ]);
    expect(result.paperDir).toBe("/Users/kohirus/Obsidian/Zotero Notes/FlowVLA");
  });

  it("builds stable hashed PDF names from bytes", async () => {
    await expect(buildHashedPdfName(new Uint8Array([1, 2, 3]))).resolves.toBe("paper-039058c6f2c0cb49.pdf");
  });

  it("rewrites common Markdown asset links into the assets folder", () => {
    expect(rewriteMarkdownAssetLinks("![a](images/a.png)\n[doc](tables/t.csv)")).toBe(
      "![a](assets/images/a.png)\n[doc](assets/tables/t.csv)",
    );
  });

  it("describes unavailable PDF hashing with a stable UI key", async () => {
    await expect(buildHashedPdfName(new Uint8Array([1]), {} as Crypto)).rejects.toMatchObject({
      name: "UiError",
      messageKey: "error.cryptoUnavailable",
      message: "No Web Crypto implementation is available for PDF hashing",
    });
  });

  it("rejects an empty Obsidian notes root with a stable UI key", async () => {
    const exporter = createObsidianExporter({
      fs: {
        exists: vi.fn(async () => false),
        mkdir: vi.fn(async () => undefined),
        readBytes: vi.fn(async () => new Uint8Array([1])),
        writeBytes: vi.fn(async () => undefined),
        writeText: vi.fn(async () => undefined),
      },
    });

    await expect(
      exporter.exportPaper({
        notesRoot: "  ",
        folderTitle: "Paper",
        sourcePdfPath: "/tmp/paper.pdf",
        mineru: { markdown: "# Paper", contentList: null, files: [] },
      }),
    ).rejects.toMatchObject({
      name: "UiError",
      messageKey: "error.obsidianRootRequired",
    });
  });

  it("wraps failed file writes with their path and original cause", async () => {
    const writeFailure = new Error("disk is full");
    const exporter = createObsidianExporter({
      fs: {
        exists: vi.fn(async () => false),
        mkdir: vi.fn(async () => undefined),
        readBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
        writeBytes: vi.fn(async () => {
          throw writeFailure;
        }),
        writeText: vi.fn(async () => undefined),
      },
    });

    try {
      await exporter.exportPaper({
        notesRoot: "/Vault",
        folderTitle: "Paper",
        sourcePdfPath: "/tmp/paper.pdf",
        mineru: { markdown: "# Paper", contentList: null, files: [] },
      });
      throw new Error("expected export to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(UiError);
      expect(error).toMatchObject({
        messageKey: "error.obsidianWriteFailed",
        variables: { path: "/Vault/Paper/paper-039058c6f2c0cb49.pdf" },
        cause: writeFailure,
      });
    }
  });
});
