import {
  registerZcoMenus,
  unregisterZcoMenuManager,
  unregisterZcoMenus,
} from "./ui/menu";
import { registerZcoReaderMenus, unregisterZcoReaderMenus } from "./ui/readerMenu";

const loadedWindows = new Set<ZoteroMainWindow>();
let pluginRootURI: string | undefined;

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

export function startupPlugin(
  data: { id: string; version: string; rootURI: string },
  _reason: number,
): Promise<void> {
  pluginRootURI = data.rootURI;
  debug(`startupPlugin requested for ${data.id} ${data.version}`);
  return startupPluginAsync(data);
}

async function startupPluginAsync(
  _data: { id: string; version: string; rootURI: string },
): Promise<void> {
  debug("Waiting for Zotero initialization, unlock, and UI readiness.");
  await Promise.all([
    (Zotero as any).initializationPromise ?? Promise.resolve(),
    (Zotero as any).unlockPromise ?? Promise.resolve(),
    (Zotero as any).uiReadyPromise ?? Promise.resolve(),
  ]);
  const windows = Zotero.getMainWindows?.() ?? [];
  debug(`Zotero UI ready; registering existing main windows: ${windows.length}`);
  registerZcoReaderMenus(pluginRootURI);
  for (const win of windows) {
    onMainWindowLoad(win as ZoteroMainWindow);
  }
}

export function shutdownPlugin(
  _data: { id: string; version: string; rootURI: string },
  _reason: number,
): void {
  for (const win of loadedWindows) {
    unregisterZcoMenus(win);
  }
  unregisterZcoReaderMenus();
  unregisterZcoMenuManager();
  loadedWindows.clear();
  pluginRootURI = undefined;
}

export function onMainWindowLoad(win: ZoteroMainWindow): void {
  if (loadedWindows.has(win)) return;
  debug(`Main window load received: ${win.document?.location?.href ?? "unknown"}`);
  registerZcoMenus(win, pluginRootURI);
  loadedWindows.add(win);
}

export function onMainWindowUnload(win: ZoteroMainWindow): void {
  unregisterZcoMenus(win);
  loadedWindows.delete(win);
}
