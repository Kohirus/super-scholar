import { describe, expect, it, vi } from "vitest";
import { exportSelectionToObsidian, promptForObsidianFolderName } from "../src/exportWorkflow";
import type { QueuePdfAttachment } from "../src/types/mineru";

describe("exportSelectionToObsidian", () => {
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
      })),
      chooseFolderName: vi.fn(async (attachment: QueuePdfAttachment) => attachment.title),
      parsePdf: vi.fn(async (_attachment, _settings, onProgress) => {
        onProgress("Uploading PDF to local MinerU service");
        onProgress("Extracting local MinerU result");
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
        stage: "Uploading PDF to local MinerU service",
        percent: expect.any(Number),
      }),
    );
    expect(progress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentTitle: "Second Paper",
        completed: 1,
        total: 2,
        stage: "Writing Obsidian files",
        percent: expect.any(Number),
      }),
    );
    expect(progress.finish).toHaveBeenCalledWith({ processed: 2, failed: 0, skipped: 0 });
    expect(progress.close).toHaveBeenCalledOnce();
  });

  it("skips an attachment when the user cancels folder naming", async () => {
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
      })),
      chooseFolderName: vi.fn(async () => null),
      parsePdf: vi.fn(),
      exportPaper: vi.fn(),
      notify: vi.fn(),
    };

    await expect(exportSelectionToObsidian({} as any, deps)).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(deps.parsePdf).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("super-scholar", "Export cancelled for Paper.");
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
});
