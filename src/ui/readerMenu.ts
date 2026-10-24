import { exportPdfAttachmentsToObsidian, showNotification } from "../exportWorkflow";
import { localizeError, translate } from "../i18n";
import type { QueuePdfAttachment } from "../types/mineru";
import { collectPdfAttachmentsFromSelection } from "../zotero/attachments";

const PLUGIN_ID = "super-scholar@Kohirus";
const READER_VIEW_CONTEXT_MENU = "createViewContextMenu";
const MENU_ICON = "content/icons/logo.svg";

let readerViewContextMenuHandler: ((event: any) => void) | null = null;

function iconPath(rootURI?: string): string {
  return rootURI ? `${rootURI}${MENU_ICON}` : MENU_ICON;
}

function debug(message: string): void {
  const formattedMessage = `[ZCO] ${message}`;
  try {
    console.warn(formattedMessage);
  } catch {
    // Console logging is best effort only.
  }
  try {
    (Zotero as any).debug?.(formattedMessage);
  } catch {
    // Debug logging is best effort only.
  }
}

function mainWindowForReader(reader: any): ZoteroMainWindow | null {
  const readerWindow = (reader?._window ?? reader?._iframe?.ownerGlobal) as
    | ZoteroMainWindow
    | undefined;
  return readerWindow ?? ((Zotero.getMainWindows?.()[0] as ZoteroMainWindow | undefined) ?? null);
}

function readerItemID(reader: any): number | null {
  const candidates = [
    reader?.itemID,
    reader?._itemID,
    reader?.item?.id,
    reader?._item?.id,
    reader?._state?.itemID,
  ];
  const itemID = candidates.find((candidate) => Number.isInteger(Number(candidate)));
  return itemID == null ? null : Number(itemID);
}

async function getReaderPdfAttachment(reader: any): Promise<QueuePdfAttachment[]> {
  const itemID = readerItemID(reader);
  if (!itemID) return [];
  const item = Zotero.Items.get(itemID) as any;
  return collectPdfAttachmentsFromSelection(item ? [item] : [], {
    getItem: (id) => Zotero.Items.get(id) as any,
  });
}

function exportReaderPdf(reader: any): void {
  const win = mainWindowForReader(reader);
  if (!win) {
    debug("Reader export skipped because no Zotero main window was found.");
    return;
  }
  void exportPdfAttachmentsToObsidian(win, () => getReaderPdfAttachment(reader)).catch((error) => {
    const message = localizeError(error);
    debug(`Reader export command failed: ${message}`);
    showNotification(win, "super-scholar", message);
  });
}

export function registerZcoReaderMenus(rootURI?: string): boolean {
  const reader = (Zotero as any).Reader;
  if (!reader?.registerEventListener) {
    debug("Zotero.Reader.registerEventListener is unavailable; reader context menu will not be registered.");
    return false;
  }

  if (typeof reader._unregisterEventListenerByPluginID === "function") {
    reader._unregisterEventListenerByPluginID(PLUGIN_ID);
  } else if (readerViewContextMenuHandler) {
    return true;
  }

  const icon = iconPath(rootURI);
  readerViewContextMenuHandler = (event: any) => {
    event.append?.({
      label: translate("menu.exportToObsidian"),
      icon,
      onCommand: () => exportReaderPdf(event.reader),
    });
  };
  reader.registerEventListener(READER_VIEW_CONTEXT_MENU, readerViewContextMenuHandler, PLUGIN_ID);
  debug("Registered Zotero Reader view context menu entry.");
  return true;
}

export function unregisterZcoReaderMenus(): void {
  const reader = (Zotero as any).Reader;
  if (readerViewContextMenuHandler && reader?.unregisterEventListener) {
    reader.unregisterEventListener(READER_VIEW_CONTEXT_MENU, readerViewContextMenuHandler);
  }
  readerViewContextMenuHandler = null;
}
