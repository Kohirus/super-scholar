import type { ExportProgressReporter, ExportProgressUpdate } from "../exportWorkflow";
import { translate, type UiLocale } from "../i18n";
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

type ProgressWindowConstructor = new (options?: { window?: Window }) => ProgressWindowLike;

export function createZoteroExportProgressReporter(options: {
  progressWindow?: ProgressWindowConstructor;
  closeDelayMs?: number;
  setTimeout?: (callback: () => void, ms: number) => unknown;
  icon?: string;
  window?: Window;
  locale?: UiLocale;
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
  const locale = options.locale;

  function ensureWindow(): ProgressWindowLike {
    if (!window) {
      window = new ProgressWindowCtor(options.window ? { window: options.window } : undefined);
      window.changeHeadline?.("super-scholar");
      if (window.ItemProgress) {
        item = new window.ItemProgress(icon, translate("progress.preparing", undefined, locale));
      } else {
        window.addDescription?.(translate("progress.preparing", undefined, locale));
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
      updateText(
        total === 1
          ? translate("progress.preparingOne", undefined, locale)
          : translate("progress.preparingMany", { total }, locale),
        0,
      );
    },
    update(update: ExportProgressUpdate) {
      const stage = translate(update.stage, update.variables, locale);
      updateText(
        translate("progress.item", { stage, title: update.attachmentTitle }, locale),
        update.percent,
      );
    },
    finish(summary: QueueSummary) {
      updateText(
        translate(
          "progress.finished",
          {
            processed: summary.processed,
            skipped: summary.skipped,
            failed: summary.failed,
          },
          locale,
        ),
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
