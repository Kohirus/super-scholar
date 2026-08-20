import type { ExportProgressReporter, ExportProgressUpdate } from "../exportWorkflow";
import type { QueueSummary } from "../types/mineru";

type ProgressWindowLike = {
  changeHeadline?(text: string): void;
  addDescription?(text: string): void;
  show?(): void;
  close?(): void;
  ItemProgress?: new (icon: string, text: string) => {
    setProgress?(percent: number): void;
    setText?(text: string): void;
  };
};

type ProgressWindowConstructor = new () => ProgressWindowLike;

export function createZoteroExportProgressReporter(options: {
  progressWindow?: ProgressWindowConstructor;
  closeDelayMs?: number;
  setTimeout?: (callback: () => void, ms: number) => unknown;
  icon?: string;
}): ExportProgressReporter | undefined {
  const ProgressWindowCandidate = options.progressWindow ?? Zotero.ProgressWindow;
  if (!ProgressWindowCandidate) return undefined;
  const ProgressWindowCtor: ProgressWindowConstructor = ProgressWindowCandidate;

  let window: ProgressWindowLike | null = null;
  let item:
    | {
        setProgress?(percent: number): void;
        setText?(text: string): void;
      }
    | null = null;

  const icon = options.icon ?? "content/icons/logo.svg";
  const closeDelayMs = options.closeDelayMs ?? 1500;
  const schedule = options.setTimeout ?? setTimeout;

  function ensureWindow(): ProgressWindowLike {
    if (!window) {
      window = new ProgressWindowCtor();
      window.changeHeadline?.("super-scholar");
      if (window.ItemProgress) {
        item = new window.ItemProgress(icon, "Preparing export");
      } else {
        window.addDescription?.("Preparing export");
      }
      window.show?.();
    }
    return window;
  }

  function updateText(text: string, percent: number): void {
    const activeWindow = ensureWindow();
    if (item?.setText || item?.setProgress) {
      item.setText?.(text);
      item.setProgress?.(percent);
      return;
    }
    activeWindow.addDescription?.(`${percent}% - ${text}`);
  }

  return {
    start({ total }) {
      updateText(total === 1 ? "Preparing 1 PDF" : `Preparing ${total} PDFs`, 0);
    },
    update(update: ExportProgressUpdate) {
      updateText(`${update.stage}: ${update.attachmentTitle}`, update.percent);
    },
    finish(summary: QueueSummary) {
      updateText(
        `Finished: ${summary.processed} exported, ${summary.skipped} skipped, ${summary.failed} failed`,
        100,
      );
    },
    close() {
      if (!window) return;
      const activeWindow = window;
      schedule(() => activeWindow.close?.(), closeDelayMs);
    },
  };
}
