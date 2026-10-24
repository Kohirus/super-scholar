import { sanitizeDirectoryName } from "./folderName";
import { localizeError, translate, type UiMessageKey } from "./i18n";
import { parsePdfWithMineru, type MineruProgressCallback } from "./mineru/client";
import { createObsidianExporter, createZoteroObsidianFs, type ObsidianExporter } from "./obsidianExporter";
import { createZoteroPrefStore, readZcoSettingsFromPrefs, type ZcoSettings } from "./settings";
import { createZoteroExportProgressReporter } from "./ui/exportProgress";
import { collectPdfAttachmentsFromSelection } from "./zotero/attachments";
import type { MineruParseResult, MineruSettings, QueuePdfAttachment, QueueSummary } from "./types/mineru";

export type ExportProgressUpdate = {
  attachmentTitle: string;
  stage: UiMessageKey;
  variables?: Record<string, string | number>;
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

function debugExport(message: string): void {
  const formattedMessage = `[ZCO][export] ${message}`;
  try {
    console.warn(formattedMessage);
  } catch {
    // Console logging is best effort only.
  }
  try {
    (Zotero as any).debug?.(formattedMessage);
  } catch {
    // Zotero diagnostic logging is best effort only.
  }
}

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
    const accepted = promptService.prompt(
      win,
      "super-scholar",
      translate("prompt.folderName"),
      value,
      null,
      checkState,
    );
    return accepted ? value.value : null;
  }

  const prompt = win.prompt?.bind(win) ?? globalThis.prompt;
  if (!prompt) {
    return attachment.title;
  }
  return prompt(translate("prompt.folderName"), attachment.title);
}

function missingSettings(settings: ZcoSettings): UiMessageKey[] {
  const missing: UiMessageKey[] = [];
  if (!settings.obsidian.notesDir.trim()) missing.push("setting.obsidianNotesDirectory");
  return missing;
}

function progressPercent(completed: number, total: number, stageFraction: number): number {
  if (total <= 0) return 0;
  const boundedStage = Math.max(0, Math.min(0.99, stageFraction));
  return Math.max(0, Math.min(99, Math.round(((completed + boundedStage) / total) * 100)));
}

function updateProgress(
  reporter: ExportProgressReporter | undefined,
  attachment: QueuePdfAttachment,
  completed: number,
  total: number,
  stage: UiMessageKey,
  stageFraction: number,
  variables?: Record<string, string | number>,
): void {
  const update: ExportProgressUpdate = {
    attachmentTitle: attachment.title,
    stage,
    completed,
    total,
    percent: progressPercent(completed, total, stageFraction),
  };
  if (variables) update.variables = variables;
  reporter?.update(update);
}

export function filterPdfAttachmentsByTitle(
  attachments: QueuePdfAttachment[],
  glob: string,
): QueuePdfAttachment[] {
  const trimmedGlob = glob.trim();
  if (!trimmedGlob) return attachments;

  return attachments.filter(
    (attachment) => !matchesFilenameGlob(attachment.attachmentTitle ?? attachment.title, trimmedGlob),
  );
}

function matchesFilenameGlob(filename: string, glob: string): boolean {
  let filenameIndex = 0;
  let globIndex = 0;
  let lastStarIndex = -1;
  let starMatchIndex = 0;

  while (filenameIndex < filename.length) {
    if (globIndex < glob.length && glob[globIndex] === filename[filenameIndex]) {
      filenameIndex += 1;
      globIndex += 1;
    } else if (globIndex < glob.length && glob[globIndex] === "*") {
      lastStarIndex = globIndex;
      starMatchIndex = filenameIndex;
      globIndex += 1;
    } else if (lastStarIndex >= 0) {
      globIndex = lastStarIndex + 1;
      starMatchIndex += 1;
      filenameIndex = starMatchIndex;
    } else {
      return false;
    }
  }

  while (globIndex < glob.length && glob[globIndex] === "*") {
    globIndex += 1;
  }

  return globIndex === glob.length;
}

export async function exportSelectionToObsidian(
  win: ZoteroMainWindow,
  deps: ExportWorkflowDeps,
): Promise<QueueSummary> {
  const discoveredAttachments = await deps.getAttachments(win);
  debugExport(`Discovered ${discoveredAttachments.length} PDF attachment(s).`);
  if (discoveredAttachments.length === 0) {
    deps.notify("super-scholar", translate("notification.noPdf"));
    return { processed: 0, skipped: 1, failed: 0 };
  }

  const settings = deps.readSettings();
  debugExport(
    `Settings loaded: MinerU mode=${settings.mineru.mode}, Obsidian directory=${settings.obsidian.notesDir.trim() ? "configured" : "missing"}.`,
  );
  const attachments = filterPdfAttachmentsByTitle(
    discoveredAttachments,
    settings.pdf.excludeFilenameGlob,
  );
  const filteredCount = discoveredAttachments.length - attachments.length;
  debugExport(`Attachment title filter kept ${attachments.length} and excluded ${filteredCount} PDF attachment(s).`);
  if (attachments.length === 0) {
    deps.notify("super-scholar", translate("notification.allFiltered"));
    return { processed: 0, skipped: filteredCount, failed: 0 };
  }

  const missing = missingSettings(settings);
  if (missing.length > 0) {
    deps.notify(
      "super-scholar",
      translate("notification.missingSettings", {
        settings: missing.map((key) => translate(key)).join(", "),
      }),
    );
    return { processed: 0, skipped: discoveredAttachments.length, failed: 0 };
  }

  const summary: QueueSummary = { processed: 0, skipped: filteredCount, failed: 0 };
  let progressStarted = false;
  debugExport(`Started export queue with ${attachments.length} PDF attachment(s).`);
  try {
    for (const [completed, attachment] of attachments.entries()) {
      try {
        debugExport(`Opening folder-name prompt for attachment ${completed + 1}/${attachments.length}.`);
        const requestedFolderTitle = await deps.chooseFolderName(attachment);
        if (!requestedFolderTitle || !requestedFolderTitle.trim()) {
          debugExport(`Folder-name prompt cancelled for attachment ${completed + 1}/${attachments.length}.`);
          summary.skipped += 1;
          if (progressStarted) {
            updateProgress(deps.progress, attachment, completed, attachments.length, "progress.cancelled", 0.99);
          }
          deps.notify(
            "super-scholar",
            translate("notification.cancelled", { title: attachment.title }),
          );
          continue;
        }
        if (!progressStarted) {
          deps.progress?.start({ total: attachments.length });
          progressStarted = true;
        }
        const folderTitle = sanitizeDirectoryName(requestedFolderTitle);
        debugExport(`Folder-name prompt accepted; starting MinerU parse for attachment ${completed + 1}/${attachments.length}.`);
        let lastMineruStage: UiMessageKey | "" = "";
        const mineru = await deps.parsePdf(attachment, settings.mineru, (progress) => {
          if (progress.key !== lastMineruStage) {
            debugExport(`MinerU stage: ${translate(progress.key, progress.variables, "en-US")}.`);
            lastMineruStage = progress.key;
          }
          updateProgress(
            deps.progress,
            attachment,
            completed,
            attachments.length,
            progress.key,
            progress.fraction,
            progress.variables,
          );
        });
        debugExport(`MinerU parse completed for attachment ${completed + 1}/${attachments.length}.`);
        updateProgress(deps.progress, attachment, completed, attachments.length, "progress.writing", 0.9);
        debugExport(`Writing Obsidian files for attachment ${completed + 1}/${attachments.length}.`);
        await deps.exportPaper({
          notesRoot: settings.obsidian.notesDir,
          folderTitle,
          sourcePdfPath: attachment.path,
          mineru,
        });
        summary.processed += 1;
        debugExport(`Completed attachment ${completed + 1}/${attachments.length}.`);
        updateProgress(deps.progress, attachment, completed + 1, attachments.length, "progress.exported", 0.99);
      } catch (error) {
        summary.failed += 1;
        debugExport(`Attachment ${completed + 1}/${attachments.length} failed: ${error instanceof Error ? error.message : String(error)}.`);
        if (progressStarted) {
          updateProgress(deps.progress, attachment, completed, attachments.length, "progress.failed", 0.99);
        }
        try {
          console.error("[ZCO] Export failed", error);
        } catch {
          // Console logging is best effort only.
        }
        deps.notify("super-scholar", localizeError(error));
      }
    }
    if (progressStarted) {
      deps.progress?.finish(summary);
    }
    debugExport(
      `Export queue finished: ${summary.processed} processed, ${summary.skipped} skipped, ${summary.failed} failed.`,
    );
    return summary;
  } finally {
    if (progressStarted) {
      deps.progress?.close();
    }
  }
}

async function getSelectedPdfAttachments(win: ZoteroMainWindow): Promise<QueuePdfAttachment[]> {
  const selectedItems = win.ZoteroPane?.getSelectedItems?.() ?? [];
  return collectPdfAttachmentsFromSelection(selectedItems as any[], {
    getItem: (id) => Zotero.Items.get(id) as any,
  });
}

export function showNotification(win: ZoteroMainWindow, title: string, message: string): void {
  try {
    const progress = new Zotero.ProgressWindow!({ window: win });
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

  const progress = createZoteroExportProgressReporter({
    icon: "content/icons/logo.svg",
    window: win,
  });
  const deps: ExportWorkflowDeps = {
    getAttachments,
    readSettings: settings,
    chooseFolderName: async (attachment) => promptForObsidianFolderName(win, attachment),
    parsePdf: (attachment, mineruSettings, onProgress) =>
      parsePdfWithMineru(attachment.path, mineruSettings, onProgress, undefined, runtime),
    exportPaper: (request) => exporter.exportPaper(request),
    notify: (title, message) => showNotification(win, title, message),
  };
  if (progress) {
    deps.progress = progress;
  }

  return exportSelectionToObsidian(win, deps);
}
