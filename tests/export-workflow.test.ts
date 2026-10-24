import { afterEach, describe, expect, it, vi } from "vitest";
import * as exportWorkflow from "../src/exportWorkflow";
import type { QueuePdfAttachment } from "../src/types/mineru";
import { UiError } from "../src/i18n";

const { exportSelectionToObsidian, promptForObsidianFolderName } = exportWorkflow;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("showNotification", () => {
  it("parents the notification window to the initiating window", () => {
    const constructorOptions: unknown[] = [];
    class ProgressWindow {
      constructor(options?: unknown) {
        constructorOptions.push(options);
      }

      changeHeadline = vi.fn();
      addDescription = vi.fn();
      show = vi.fn();
      close = vi.fn();
    }
    const showNotification = (
      exportWorkflow as typeof exportWorkflow & {
        showNotification?: (win: ZoteroMainWindow, title: string, message: string) => void;
      }
    ).showNotification;

    expect(showNotification).toBeTypeOf("function");
    if (!showNotification) return;

    vi.stubGlobal("Zotero", { ProgressWindow });
    vi.useFakeTimers();
    const initiatingWindow = {} as ZoteroMainWindow;
    showNotification(initiatingWindow, "super-scholar", "Failed");

    expect(constructorOptions).toEqual([{ window: initiatingWindow }]);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

function filterPdfAttachmentsByTitle(
  attachments: QueuePdfAttachment[],
  glob: string,
): QueuePdfAttachment[] {
  return (
    exportWorkflow as typeof exportWorkflow & {
      filterPdfAttachmentsByTitle: (
        attachments: QueuePdfAttachment[],
        glob: string,
      ) => QueuePdfAttachment[];
    }
  ).filterPdfAttachmentsByTitle(attachments, glob);
}

describe("filterPdfAttachmentsByTitle", () => {
  const attachments: QueuePdfAttachment[] = [
    { id: 1, key: "MAIN", title: "main", path: "D:\\papers\\stored-main.pdf" },
    { id: 2, key: "DUAL", title: "paper-dual", path: "/papers/paper_dual.pdf" },
    { id: 3, key: "EXTRA", title: "paper-dual-extra", path: "/papers/stored-extra.pdf" },
    { id: 4, key: "UPPER", title: "Paper-DUAL", path: "/papers/stored-upper.PDF" },
    { id: 5, key: "META", title: "draft[1]", path: "/papers/stored-meta.pdf" },
  ];

  it("keeps every attachment when the pattern is blank", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "   ")).toEqual(attachments);
  });

  it("matches an anchored star glob against the attachment title", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "*-dual")).toEqual([
      attachments[0],
      attachments[2],
      attachments[3],
      attachments[4],
    ]);
  });

  it("keeps attachment-title matching case-sensitive", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "Paper-DUAL")).toEqual([
      attachments[0],
      attachments[1],
      attachments[2],
      attachments[4],
    ]);
  });

  it("does not match against the stored file path", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "main")).toEqual(attachments.slice(1));
  });

  it("treats regex metacharacters as literal title characters", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "*[1]")).toEqual(attachments.slice(0, 4));
  });

  it("lets a bare star exclude every PDF", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "*")).toEqual([]);
  });

  it("lets star match line terminators in valid POSIX filenames", () => {
    const attachment = {
      id: 6,
      key: "NEWLINE",
      title: "paper\nversion",
      path: "/papers/stored-newline.pdf",
    };

    expect(filterPdfAttachmentsByTitle([attachment], "*")).toEqual([]);
  });

  it("handles separated wildcards in bounded time", () => {
    const attachment = {
      id: 7,
      key: "LONG",
      title: "a".repeat(36),
      path: "/papers/stored-long.pdf",
    };
    const startedAt = performance.now();

    expect(
      filterPdfAttachmentsByTitle([attachment], "*a*a*a*a*a*a*a*a*b"),
    ).toEqual([attachment]);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });

  it("treats dots as literal title characters", () => {
    expect(filterPdfAttachmentsByTitle(attachments, "paper.dual")).toEqual(attachments);
  });
});

describe("exportSelectionToObsidian", () => {
  it("logs attachment discovery before an early exit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const debug = vi.fn();
    vi.stubGlobal("Zotero", { debug });
    const deps = {
      getAttachments: vi.fn(async () => []),
      readSettings: vi.fn(),
      chooseFolderName: vi.fn(),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
    };

    await exportSelectionToObsidian({} as ZoteroMainWindow, deps as any);

    expect(warn).toHaveBeenCalledWith("[ZCO][export] Discovered 0 PDF attachment(s).");
    expect(debug).toHaveBeenCalledWith("[ZCO][export] Discovered 0 PDF attachment(s).");
    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it("opens repeated folder-name prompts through Zotero prompt service", () => {
    const attachment: QueuePdfAttachment = {
      id: 1,
      key: "PDF1",
      title: "Long Paper Title",
      path: "D:/paper.pdf",
    };
    const win = {} as ZoteroMainWindow;
    const prompt = vi.fn(
      (_parent: Window, _title: string, _text: string, value: { value: string }) => {
        value.value = `Folder ${prompt.mock.calls.length}`;
        return true;
      },
    );

    expect(promptForObsidianFolderName(win, attachment, { prompt })).toBe("Folder 1");
    expect(promptForObsidianFolderName(win, attachment, { prompt })).toBe("Folder 2");

    expect(prompt).toHaveBeenCalledTimes(2);
    expect(prompt).toHaveBeenCalledWith(
      win,
      "super-scholar",
      "Obsidian folder name",
      expect.objectContaining({ value: "Folder 1" }),
      null,
      expect.objectContaining({ value: false }),
    );
  });

  it("returns null when the Zotero folder-name prompt is cancelled", () => {
    const attachment: QueuePdfAttachment = {
      id: 1,
      key: "PDF1",
      title: "Long Paper Title",
      path: "D:/paper.pdf",
    };
    const prompt = vi.fn(() => false);

    expect(promptForObsidianFolderName({} as ZoteroMainWindow, attachment, { prompt })).toBeNull();
  });

  it("uses the Zotero Simplified Chinese locale for the folder-name prompt", () => {
    vi.stubGlobal("Zotero", { locale: "zh-CN" });
    const attachment: QueuePdfAttachment = {
      id: 1,
      key: "PDF1",
      title: "论文标题",
      path: "/tmp/paper.pdf",
    };
    const prompt = vi.fn(() => false);

    promptForObsidianFolderName({} as ZoteroMainWindow, attachment, { prompt });

    expect(prompt).toHaveBeenCalledWith(
      expect.anything(),
      "super-scholar",
      "Obsidian 文件夹名称",
      expect.objectContaining({ value: "论文标题" }),
      null,
      expect.objectContaining({ value: false }),
    );
  });

  it("prompts for a folder name, parses with MinerU, and exports only the PDF plus Markdown to Obsidian", async () => {
    const attachment: QueuePdfAttachment = {
      id: 1,
      key: "PDF1",
      title: "Long Paper Title",
      path: "D:/paper.pdf",
    };
    const deps = {
      getAttachments: vi.fn(async () => [attachment]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: {
          notesDir: "D:/Vault",
        },
        pdf: {
          excludeFilenameGlob: "",
        },
      })),
      chooseFolderName: vi.fn(async () => "User: Folder?"),
      parsePdf: vi.fn(async () => ({
        markdown: "# Parsed",
        contentList: null,
        files: [],
      })),
      exportPaper: vi.fn(async () => ({
        paperDir: "D:/Vault/User Folder",
        pdfPath: "D:/Vault/User Folder/paper-hash.pdf",
        sourceMarkdownPath: "D:/Vault/User Folder/原文解析.md",
      })),
      notify: vi.fn(),
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 1,
      failed: 0,
      skipped: 0,
    });
    expect(deps.chooseFolderName).toHaveBeenCalledWith(attachment);
    expect(deps.parsePdf).toHaveBeenCalledWith(attachment, deps.readSettings().mineru, expect.any(Function));
    expect(deps.exportPaper).toHaveBeenCalledWith({
      notesRoot: "D:/Vault",
      folderTitle: "User Folder",
      sourcePdfPath: "D:/paper.pdf",
      mineru: {
        markdown: "# Parsed",
        contentList: null,
        files: [],
      },
    });
  });

  it("reports progress through one lifecycle while parsing and exporting selected PDFs", async () => {
    const attachments: QueuePdfAttachment[] = [
      { id: 1, key: "PDF1", title: "First Paper", path: "D:/first.pdf" },
      { id: 2, key: "PDF2", title: "Second Paper", path: "D:/second.pdf" },
    ];
    const progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
      close: vi.fn(),
    };
    const deps = {
      getAttachments: vi.fn(async () => attachments),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: {
          notesDir: "D:/Vault",
        },
        pdf: {
          excludeFilenameGlob: "",
        },
      })),
      chooseFolderName: vi.fn(async (attachment: QueuePdfAttachment) => attachment.title),
      parsePdf: vi.fn(async (_attachment, _settings, onProgress) => {
        onProgress({ key: "mineru.local.uploading", fraction: 0.35 });
        onProgress({ key: "mineru.local.extracting", fraction: 0.75 });
        return {
          markdown: "# Parsed",
          contentList: null,
          files: [],
        };
      }),
      exportPaper: vi.fn(async () => ({
        paperDir: "D:/Vault/Paper",
        pdfPath: "D:/Vault/Paper/paper-hash.pdf",
        sourceMarkdownPath: "D:/Vault/Paper/原文解析.md",
      })),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 2,
      failed: 0,
      skipped: 0,
    });

    expect(progress.start).toHaveBeenCalledWith({ total: 2 });
    expect(progress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentTitle: "First Paper",
        completed: 0,
        total: 2,
        stage: "mineru.local.uploading",
        percent: expect.any(Number),
      }),
    );
    expect(progress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentTitle: "Second Paper",
        completed: 1,
        total: 2,
        stage: "progress.writing",
        percent: expect.any(Number),
      }),
    );
    expect(progress.finish).toHaveBeenCalledWith({ processed: 2, failed: 0, skipped: 0 });
    expect(progress.close).toHaveBeenCalledOnce();
  });

  it("skips an attachment when the user cancels folder naming", async () => {
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const deps = {
      getAttachments: vi.fn(async () => [{ id: 1, key: "PDF1", title: "Paper", path: "paper.pdf" }]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: {
          notesDir: "D:/Vault",
        },
        pdf: {
          excludeFilenameGlob: "",
        },
      })),
      chooseFolderName: vi.fn(async () => null),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(deps.parsePdf).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("super-scholar", "Export cancelled for Paper.");
    expect(progress.start).not.toHaveBeenCalled();
    expect(progress.update).not.toHaveBeenCalled();
    expect(progress.finish).not.toHaveBeenCalled();
    expect(progress.close).not.toHaveBeenCalled();
  });

  it("does not create progress when folder naming fails before export starts", async () => {
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const deps = {
      getAttachments: vi.fn(async () => [{ id: 1, key: "PDF1", title: "Paper", path: "paper.pdf" }]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "D:/Vault" },
        pdf: { excludeFilenameGlob: "" },
      })),
      chooseFolderName: vi.fn(async () => {
        throw new Error("prompt unavailable");
      }),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 0,
      failed: 1,
      skipped: 0,
    });
    expect(progress.start).not.toHaveBeenCalled();
    expect(progress.update).not.toHaveBeenCalled();
    expect(progress.finish).not.toHaveBeenCalled();
    expect(progress.close).not.toHaveBeenCalled();
  });

  it("skips work when required settings are missing", async () => {
    const deps = {
      getAttachments: vi.fn(async () => [{ id: 1, key: "PDF1", title: "Paper", path: "paper.pdf" }]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: {
          notesDir: "",
        },
        pdf: {
          excludeFilenameGlob: "",
        },
      })),
      chooseFolderName: vi.fn(),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(deps.notify).toHaveBeenCalledWith("super-scholar", expect.stringContaining("Missing"));
    expect(deps.parsePdf).not.toHaveBeenCalled();
  });

  it("filters matching attachment titles before progress, prompts, parsing, and export", async () => {
    const kept = {
      id: 1,
      key: "MAIN",
      title: "Parent Paper",
      attachmentTitle: "Full Text PDF",
      path: "D:/papers/main.pdf",
    };
    const filtered = {
      id: 2,
      key: "SUP",
      title: "Parent Paper",
      attachmentTitle: "Paper-deepseek-dual",
      path: "D:/papers/stored_under_dual.pdf",
    };
    const progress = {
      start: vi.fn(),
      update: vi.fn(),
      finish: vi.fn(),
      close: vi.fn(),
    };
    const deps = {
      getAttachments: vi.fn(async () => [filtered, kept]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "D:/Vault" },
        pdf: { excludeFilenameGlob: "*-dual" },
      })),
      chooseFolderName: vi.fn(async () => "Paper"),
      parsePdf: vi.fn(async () => ({ markdown: "# Parsed", contentList: null, files: [] })),
      exportPaper: vi.fn(async () => ({
        paperDir: "D:/Vault/Paper",
        pdfPath: "D:/Vault/Paper/paper-hash.pdf",
        sourceMarkdownPath: "D:/Vault/Paper/原文解析.md",
      })),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 1,
      failed: 0,
      skipped: 1,
    });
    expect(progress.start).toHaveBeenCalledWith({ total: 1 });
    expect(progress.update).toHaveBeenCalledWith(expect.objectContaining({ completed: 0, total: 1 }));
    expect(deps.chooseFolderName).toHaveBeenCalledExactlyOnceWith(kept);
    expect(deps.parsePdf).toHaveBeenCalledExactlyOnceWith(kept, deps.readSettings().mineru, expect.any(Function));
  });

  it("does not create the progress window until folder naming is accepted", async () => {
    const attachment = { id: 1, key: "MAIN", title: "Paper", path: "D:/papers/main.pdf" };
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const deps = {
      getAttachments: vi.fn(async () => [attachment]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "D:/Vault" },
        pdf: { excludeFilenameGlob: "" },
      })),
      chooseFolderName: vi.fn(async () => {
        expect(progress.start).not.toHaveBeenCalled();
        expect(progress.update).not.toHaveBeenCalled();
        return "Paper";
      }),
      parsePdf: vi.fn(async () => ({ markdown: "# Parsed", contentList: null, files: [] })),
      exportPaper: vi.fn(async () => ({
        paperDir: "D:/Vault/Paper",
        pdfPath: "D:/Vault/Paper/paper-hash.pdf",
        sourceMarkdownPath: "D:/Vault/Paper/原文解析.md",
      })),
      notify: vi.fn(),
      progress,
    };

    const summary = await exportSelectionToObsidian({} as any, deps);

    expect(summary).toEqual({ processed: 1, skipped: 0, failed: 0 });
    expect(progress.start).toHaveBeenCalledWith({ total: 1 });
  });

  it("does not start an export when every attachment title is filtered", async () => {
    const attachments = [
      { id: 1, key: "SUP", title: "Paper", path: "D:/papers/supplement.pdf" },
      { id: 2, key: "APP", title: "Paper", path: "D:/papers/appendix.pdf" },
    ];
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const deps = {
      getAttachments: vi.fn(async () => attachments),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "D:/Vault" },
        pdf: { excludeFilenameGlob: "*" },
      })),
      chooseFolderName: vi.fn(),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 2,
    });
    expect(progress.start).not.toHaveBeenCalled();
    expect(deps.chooseFolderName).not.toHaveBeenCalled();
    expect(deps.parsePdf).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(
      "super-scholar",
      "All PDF attachments were excluded by the attachment title filter.",
    );
  });

  it("treats regex metacharacters literally without aborting the export", async () => {
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const deps = {
      getAttachments: vi.fn(async () => [
        { id: 1, key: "ONE", title: "First", path: "D:/papers/first.pdf" },
        { id: 2, key: "TWO", title: "Second", path: "D:/papers/second.pdf" },
      ]),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "D:/Vault" },
        pdf: { excludeFilenameGlob: "[" },
      })),
      chooseFolderName: vi.fn(async (attachment: QueuePdfAttachment) => attachment.title),
      parsePdf: vi.fn(async () => ({ markdown: "# Parsed", contentList: null, files: [] })),
      exportPaper: vi.fn(async () => ({
        paperDir: "D:/Vault/Paper",
        pdfPath: "D:/Vault/Paper/paper-hash.pdf",
        sourceMarkdownPath: "D:/Vault/Paper/原文解析.md",
      })),
      notify: vi.fn(),
      progress,
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 2,
      failed: 0,
      skipped: 0,
    });
    expect(progress.start).toHaveBeenCalledWith({ total: 2 });
    expect(deps.parsePdf).toHaveBeenCalledTimes(2);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it.each([
    ["en-US", "No PDF attachments found in the current selection."],
    ["zh-CN", "当前所选条目中没有找到 PDF 附件。"],
  ])("localizes the empty-selection notice for %s", async (locale, expected) => {
    vi.stubGlobal("Zotero", { locale });
    const deps = {
      getAttachments: vi.fn(async () => []),
      readSettings: vi.fn(),
      chooseFolderName: vi.fn(),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
    };

    await exportSelectionToObsidian({} as ZoteroMainWindow, deps as any);

    expect(deps.notify).toHaveBeenCalledWith("super-scholar", expected);
  });

  it("localizes filtering, missing settings, and cancellation in Simplified Chinese", async () => {
    vi.stubGlobal("Zotero", { locale: "zh-CN" });
    const attachment = { id: 1, key: "PDF", title: "论文", path: "/tmp/paper.pdf" };
    const settings = {
      mineru: {
        mode: "local" as const,
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline" as const,
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "",
        cloudModel: "auto" as const,
        forceOcr: false,
      },
      obsidian: { notesDir: "/Vault" },
      pdf: { excludeFilenameGlob: "" },
    };
    const baseDeps = {
      getAttachments: vi.fn(async () => [attachment]),
      readSettings: vi.fn(() => settings),
      chooseFolderName: vi.fn(async () => null),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
    };

    await exportSelectionToObsidian({} as ZoteroMainWindow, baseDeps);
    expect(baseDeps.notify).toHaveBeenCalledWith("super-scholar", "已取消导出 论文。");

    baseDeps.readSettings.mockReturnValue({
      ...settings,
      obsidian: { notesDir: "" },
    });
    await exportSelectionToObsidian({} as ZoteroMainWindow, baseDeps);
    expect(baseDeps.notify).toHaveBeenCalledWith(
      "super-scholar",
      "缺少必填设置：Obsidian 笔记目录。",
    );

    baseDeps.readSettings.mockReturnValue({
      ...settings,
      pdf: { excludeFilenameGlob: "*" },
    });
    await exportSelectionToObsidian({} as ZoteroMainWindow, baseDeps);
    expect(baseDeps.notify).toHaveBeenCalledWith(
      "super-scholar",
      "所有 PDF 附件都已被附件标题过滤规则排除。",
    );
  });

  it("localizes known failures, preserves unknown diagnostics, and handles each failure once", async () => {
    vi.stubGlobal("Zotero", { locale: "zh-CN" });
    const attachments = [
      { id: 1, key: "KNOWN", title: "Known", path: "/tmp/known.pdf" },
      { id: 2, key: "RAW", title: "Raw", path: "/tmp/raw.pdf" },
    ];
    const notify = vi.fn();
    const progress = { start: vi.fn(), update: vi.fn(), finish: vi.fn(), close: vi.fn() };
    const exportPaper = vi
      .fn()
      .mockRejectedValueOnce(
        new UiError(
          "error.localRequestFailed",
          { status: 503 },
          "Local MinerU parse failed: HTTP 503",
        ),
      )
      .mockRejectedValueOnce(new Error("custom plugin failure"));
    const deps = {
      getAttachments: vi.fn(async () => attachments),
      readSettings: vi.fn(() => ({
        mineru: {
          mode: "local" as const,
          localApiBase: "http://127.0.0.1:8000",
          localBackend: "pipeline" as const,
          cloudApiBase: "https://mineru.net/api/v4",
          cloudApiKey: "",
          cloudModel: "auto" as const,
          forceOcr: false,
        },
        obsidian: { notesDir: "/Vault" },
        pdf: { excludeFilenameGlob: "" },
      })),
      chooseFolderName: vi.fn(async (attachment: QueuePdfAttachment) => attachment.title),
      parsePdf: vi.fn(async () => ({ markdown: "# Parsed", contentList: null, files: [] })),
      exportPaper,
      notify,
      progress,
    };

    await expect(exportSelectionToObsidian({} as ZoteroMainWindow, deps)).resolves.toEqual({
      processed: 0,
      skipped: 0,
      failed: 2,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(notify.mock.calls).toEqual([
      ["super-scholar", "本地 MinerU 请求失败（HTTP 503）。"],
      ["super-scholar", "custom plugin failure"],
    ]);
    expect(exportPaper).toHaveBeenCalledTimes(2);
    expect(progress.finish).toHaveBeenCalledOnce();
    expect(progress.close).toHaveBeenCalledOnce();
  });
});
