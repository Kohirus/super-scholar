import {
  onMainWindowLoad as loadMainWindow,
  onMainWindowUnload as unloadMainWindow,
  startupPlugin,
  shutdownPlugin,
} from "./hooks";

function debug(message: string): void {
  const formattedMessage = `[ZCO] ${message}`;
  try {
    console.warn(formattedMessage);
  } catch {
    // Console logging is best effort only.
  }
}

export function startup(data: { id: string; version: string; rootURI: string }, reason: number): Promise<void> {
  debug(`bundle startup called for ${data.id} ${data.version}`);
  return startupPlugin(data, reason);
}

export function shutdown(data: { id: string; version: string; rootURI: string }, reason: number): void {
  shutdownPlugin(data, reason);
}

export function install(): void {
  // No install-time migration is needed for the first release.
}

export function uninstall(): void {
  // User data and caches are intentionally left in place on uninstall.
}

function resolveMainWindow(data: { window?: ZoteroMainWindow } | ZoteroMainWindow): ZoteroMainWindow | null {
  if ("window" in data && data.window?.document) {
    return data.window;
  }
  return "document" in data && data.document ? (data as ZoteroMainWindow) : null;
}

export function onMainWindowLoad(data: { window?: ZoteroMainWindow } | ZoteroMainWindow): void {
  const win = resolveMainWindow(data);
  if (win) {
    debug(`bundle onMainWindowLoad accepted: ${win.document?.location?.href ?? "unknown"}`);
    loadMainWindow(win);
  } else {
    debug("bundle onMainWindowLoad ignored data without a window document.");
  }
}

export function onMainWindowUnload(data: { window?: ZoteroMainWindow } | ZoteroMainWindow): void {
  const win = resolveMainWindow(data);
  if (win) {
    unloadMainWindow(win);
  }
}
