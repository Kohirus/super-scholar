import { sanitizeDirectoryName } from "./folderName";
import { parsePdfWithMineru, type MineruProgressCallback } from "./mineru/client";
import { createObsidianExporter, createZoteroObsidianFs, type ObsidianExporter } from "./obsidianExporter";
import { createZoteroPrefStore, readZcoSettingsFromPrefs, type ZcoSettings } from "./settings";
import { createZoteroExportProgressReporter } from "./ui/exportProgress";
import { collectPdfAttachmentsFromSelection } from "./zotero/attachments";
import type { MineruParseResult, MineruSettings, QueuePdfAttachment, QueueSummary } from "./types/mineru";

export type ExportProgressUpdate = {
  attachmentTitle: string;
  stage: string;
  completed: number;
  total: number;
  percent: number;
};

export type ExportProgressReporter = {
  start(options: { total: number }): void;
  update(update: ExportProgressUpdate): void;
  finish(summary: QueueSummary): void;
  close(): void;
};

export type ExportWorkflowDeps = {
  getAttachments(win: ZoteroMainWindow): Promise<QueuePdfAttachment[]>;
  readSettings(): ZcoSettings;
  chooseFolderName(attachment: QueuePdfAttachment): Promise<string | null>;
  parsePdf(
    attachment: QueuePdfAttachment,
    settings: MineruSettings,
    onProgress: MineruProgressCallback,
  ): Promise<MineruParseResult>;
  exportPaper: ObsidianExporter["exportPaper"];
  notify(title: string, message: string): void;
  progress?: ExportProgressReporter;
};

export type ZoteroPromptService = {
  prompt(
    parent: Window,
    dialogTitle: string,
    text: string,
    value: { value: string },
    checkMsg: string | null,
    checkState: { value: boolean },
  ): boolean;
};

function getZoteroPromptService(): ZoteroPromptService | undefined {
  try {
    return typeof Services !== "undefined" ? Services.prompt : undefined;
  } catch {
    return undefined;
  }
}

export function promptForObsidianFolderName(
  win: ZoteroMainWindow,
  attachment: QueuePdfAttachment,
  promptService = getZoteroPromptService(),
): string | null {
  if (promptService?.prompt) {
    const value = { value: attachment.title };
    const checkState = { value: false };
    const accepted = promptService.prompt(win, "super-scholar", "Obsidian folder name", value, null, checkState);
    return accepted ? value.value : null;
  }

  const prompt = win.prompt?.bind(win) ?? globalThis.prompt;
  if (!prompt) {
    return attachment.title;
  }
  return prompt("Obsidian folder name", attachment.title);
}

function missingSettings(settings: ZcoSettings): string[] {
  const missing: string[] = [];
  if (!settings.obsidian.notesDir.trim()) missing.push("Obsidian notes directory");
  return missing;
}

function progressPercent(completed: number, total: number, stageFraction: number): number {
  if (total <= 0) return 0;
  const boundedStage = Math.max(0, Math.min(0.99, stageFraction));
  return Math.max(0, Math.min(99, Math.round(((completed + boundedStage) / total) * 100)));
}

function mineruStageFraction(stage: string): number {
  if (/upload/i.test(stage)) return 0.35;
  if (/waiting/i.test(stage)) return 0.55;
  if (/download|extract/i.test(stage)) return 0.75;
  return 0.5;
}

function updateProgress(
  reporter: ExportProgressReporter | undefined,
  attachment: QueuePdfAttachment,
  completed: number,
  total: number,
  stage: string,
  stageFraction: number,
): void {
  reporter?.update({
    attachmentTitle: attachment.title,
    stage,
    completed,
    total,
    percent: progressPercent(completed, total, stageFraction),
  });
}

export async function exportSelectionToObsidian(
  win: ZoteroMainWindow,
  deps: ExportWorkflowDeps,
): Promise<QueueSummary> {
  const attachments = await deps.getAttachments(win);
  if (attachments.length === 0) {
    deps.notify("super-scholar", "No PDF attachments found in the current selection.");
    return { processed: 0, skipped: 1, failed: 0 };
  }

  const settings = deps.readSettings();
  const missing = missingSettings(settings);
  if (missing.length > 0) {
    deps.notify("super-scholar", `Missing required settings: ${missing.join(", ")}.`);
    return { processed: 0, skipped: attachments.length, failed: 0 };
  }

  const summary: QueueSummary = { processed: 0, skipped: 0, failed: 0 };
  deps.progress?.start({ total: attachments.length });
  try {
    for (const attachment of attachments) {
      const completed = summary.processed + summary.skipped + summary.failed;
      try {
        updateProgress(deps.progress, attachment, completed, attachments.length, "Choosing Obsidian folder", 0.05);
        const requestedFolderTitle = await deps.chooseFolderName(attachment);
        if (!requestedFolderTitle || !requestedFolderTitle.trim()) {
          summary.skipped += 1;
          updateProgress(deps.progress, attachment, completed, attachments.length, "Export cancelled", 0.99);
          deps.notify("super-scholar", `Export cancelled for ${attachment.title}.`);
          continue;
        }
        const folderTitle = sanitizeDirectoryName(requestedFolderTitle);
        const mineru = await deps.parsePdf(attachment, settings.mineru, (stage) => {
          updateProgress(deps.progress, attachment, completed, attachments.length, stage, mineruStageFraction(stage));
        });
        updateProgress(deps.progress, attachment, completed, attachments.length, "Writing Obsidian files", 0.9);
        await deps.exportPaper({
          notesRoot: settings.obsidian.notesDir,
          folderTitle,
          sourcePdfPath: attachment.path,
          mineru,
        });
        summary.processed += 1;
        updateProgress(deps.progress, attachment, completed + 1, attachments.length, "Exported", 0.99);
      } catch (error) {
        summary.failed += 1;
        updateProgress(deps.progress, attachment, completed, attachments.length, "Export failed", 0.99);
        try {
          console.error("[ZCO] Export failed", error);
        } catch {
          // Console logging is best effort only.
        }
        deps.notify("super-scholar", error instanceof Error ? error.message : String(error));
      }
    }
    deps.progress?.finish(summary);
    return summary;
  } finally {
    deps.progress?.close();
  }
}

async function getSelectedPdfAttachments(win: ZoteroMainWindow): Promise<QueuePdfAttachment[]> {
  const selectedItems = win.ZoteroPane?.getSelectedItems?.() ?? [];
  return collectPdfAttachmentsFromSelection(selectedItems as any[], {
    getItem: (id) => Zotero.Items.get(id) as any,
  });
}

function showNotification(title: string, message: string): void {
  try {
    const progress = new Zotero.ProgressWindow!();
    progress.changeHeadline(title);
    progress.addDescription(message);
    progress.show();
    setTimeout(() => progress.close(), 4000);
  } catch {
    // Notifications should not break export workflows.
  }
}

export async function exportCurrentSelectionToObsidian(win: ZoteroMainWindow): Promise<QueueSummary> {
  return exportPdfAttachmentsToObsidian(win, getSelectedPdfAttachments);
}

export async function exportPdfAttachmentsToObsidian(
  win: ZoteroMainWindow,
  getAttachments: (win: ZoteroMainWindow) => Promise<QueuePdfAttachment[]>,
): Promise<QueueSummary> {
  const settings = () => readZcoSettingsFromPrefs(createZoteroPrefStore(Zotero));
  const exporter = createObsidianExporter({
    fs: createZoteroObsidianFs(IOUtils),
    crypto: win.crypto ?? globalThis.crypto,
  });
  const runtime = {
    fetch: win.fetch?.bind(win) ?? globalThis.fetch,
    FormData: win.FormData ?? globalThis.FormData,
    Blob: win.Blob ?? globalThis.Blob,
  };

  const progress = createZoteroExportProgressReporter({ icon: "content/icons/logo.svg" });
  const deps: ExportWorkflowDeps = {
    getAttachments,
    readSettings: settings,
    chooseFolderName: async (attachment) => promptForObsidianFolderName(win, attachment),
    parsePdf: (attachment, mineruSettings, onProgress) =>
      parsePdfWithMineru(attachment.path, mineruSettings, onProgress, undefined, runtime),
    exportPaper: (request) => exporter.exportPaper(request),
    notify: showNotification,
  };
  if (progress) {
    deps.progress = progress;
  }

  return exportSelectionToObsidian(win, deps);
}
