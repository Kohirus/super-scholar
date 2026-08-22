import { exportCurrentSelectionToObsidian } from "../exportWorkflow";

const FALLBACK_MENU_IDS = ["zco-item-menu"];
const ZCO_MAIN_WINDOW_FTL = "zotero-codex-obsidian.ftl";
const PLUGIN_ID = "super-scholar@Kohirus";
const MENU_ICON = "content/icons/logo.svg";
const MENU_LABEL = "输出到 Obsidian";
let registeredMenuIDs: unknown[] = [];
const fallbackPopupListeners = new WeakMap<
  ZoteroMainWindow,
  Array<{ element: Element; handler: EventListener }>
>();
const fallbackDedupedPopups = new WeakMap<ZoteroMainWindow, WeakSet<Element>>();
const fallbackRegisteredIDs = new WeakMap<ZoteroMainWindow, Set<string>>();
const fallbackObservers = new WeakMap<ZoteroMainWindow, { disconnect(): void }>();

function doc(win: Window): Document {
  return win.document;
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

function registerMainWindowLocale(win: ZoteroMainWindow): void {
  try {
    (win as any).MozXULElement?.insertFTLIfNeeded?.(ZCO_MAIN_WINDOW_FTL);
    debug(`Inserted main-window Fluent file: ${ZCO_MAIN_WINDOW_FTL}`);
  } catch (error) {
    debug(`Failed to insert main-window Fluent file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function unregisterMainWindowLocale(win: ZoteroMainWindow): void {
  try {
    doc(win).querySelector?.(`[href="${ZCO_MAIN_WINDOW_FTL}"]`)?.remove();
  } catch {
    // Locale cleanup should not block shutdown.
  }
}

function runExport(win: ZoteroMainWindow): void {
  void exportCurrentSelectionToObsidian(win).catch((error) => {
    debug(`Export command failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

function scheduleExport(win: ZoteroMainWindow): void {
  const schedule = win.setTimeout?.bind(win) ?? globalThis.setTimeout;
  schedule(() => runExport(win), 0);
}

function getWindowFromCommandEvent(event: Event, fallbackWin?: ZoteroMainWindow): ZoteroMainWindow | null {
  const target = event.target as { ownerDocument?: Document } | null;
  const eventWin = target?.ownerDocument?.defaultView as ZoteroMainWindow | undefined;
  return eventWin ?? fallbackWin ?? ((Zotero.getMainWindows?.()[0] as ZoteroMainWindow | undefined) ?? null);
}

function addFallbackMenuItem(
  win: ZoteroMainWindow,
  parent: Element | null,
  id: string,
  label: string,
  icon: string,
  command: () => void,
): void {
  if (!parent || findFallbackMenuItem(win, parent, id)) return;
  const documentWithXul = doc(win) as Document & {
    createXULElement?: (name: string) => Element;
  };
  const item = documentWithXul.createXULElement
    ? documentWithXul.createXULElement("menuitem")
    : documentWithXul.createElement("menuitem");
  item.setAttribute("id", id);
  item.setAttribute("label", label);
  item.setAttribute("class", "menuitem-iconic");
  item.setAttribute("image", icon);
  item.addEventListener("command", command);
  parent.appendChild(item);
}

function findFallbackMenuItem(win: ZoteroMainWindow, parent: Element, id: string): Element | null {
  const childMatch = Array.from(parent.children ?? []).find((child) => child.getAttribute("id") === id);
  return childMatch ?? parent.querySelector?.(`#${id}`) ?? doc(win).getElementById(id);
}

function isZcoMenuElement(element: Element): boolean {
  return (
    element.getAttribute("id") === "zco-item-menu" ||
    element.getAttribute("label") === MENU_LABEL ||
    element.textContent === MENU_LABEL ||
    (element as HTMLElement).dataset?.l10nId === "zco-output-to-obsidian"
  );
}

function dedupeZcoMenuItems(parent: Element): void {
  let first: Element | null = null;
  for (const child of Array.from(parent.children ?? [])) {
    if (!isZcoMenuElement(child)) continue;
    if (!first) {
      first = child;
      continue;
    }
    child.remove();
  }
}

function iconPath(rootURI?: string): string {
  return rootURI ? `${rootURI}${MENU_ICON}` : MENU_ICON;
}

export function registerZcoMenuManager(win?: ZoteroMainWindow, rootURI?: string): boolean {
  const menuManager = (Zotero as any).MenuManager;
  try {
    if (typeof menuManager?._unregisterByPluginID === "function") {
      void menuManager._unregisterByPluginID(PLUGIN_ID);
    }
  } catch (error) {
    debug(`MenuManager stale cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  debug("Using legacy library item menu entry for stable repeated command handling.");
  return false;
}

function trackFallbackListener(win: ZoteroMainWindow, element: Element, handler: EventListener): void {
  const listeners = fallbackPopupListeners.get(win) ?? [];
  listeners.push({ element, handler });
  fallbackPopupListeners.set(win, listeners);
}

function registerPopupDeduper(win: ZoteroMainWindow, parent: Element | null): void {
  if (!parent) return;
  const dedupedPopups = fallbackDedupedPopups.get(win) ?? new WeakSet<Element>();
  if (dedupedPopups.has(parent)) return;
  dedupedPopups.add(parent);
  fallbackDedupedPopups.set(win, dedupedPopups);
  const dedupeItems = () => dedupeZcoMenuItems(parent);
  parent.addEventListener("popupshowing", dedupeItems);
  trackFallbackListener(win, parent, dedupeItems);
}

function registerFallbackPopupMenuItem(
  win: ZoteroMainWindow,
  parent: Element | null,
  id: string,
  label: string,
  icon: string,
  command: () => void,
): void {
  if (!parent) return;
  const registeredIDs = fallbackRegisteredIDs.get(win) ?? new Set<string>();
  if (registeredIDs.has(id)) return;
  registeredIDs.add(id);
  fallbackRegisteredIDs.set(win, registeredIDs);
  const ensureItem = () => addFallbackMenuItem(win, parent, id, label, icon, command);
  ensureItem();
  parent.addEventListener("popupshowing", ensureItem);
  trackFallbackListener(win, parent, ensureItem);
  registerPopupDeduper(win, parent);
  debug(`Registered legacy popup fallback menu item: ${id}`);
}

function registerVisibleMenuDedupers(win: ZoteroMainWindow): void {
  const itemMenu =
    doc(win).getElementById("zotero-itemmenu") ??
    doc(win).getElementById("zotero-itemmenu-addontop");
  registerPopupDeduper(win, itemMenu);
}

function registerVisibleFallbackMenus(win: ZoteroMainWindow, rootURI?: string): boolean {
  const icon = iconPath(rootURI);
  const itemMenu =
    doc(win).getElementById("zotero-itemmenu") ??
    doc(win).getElementById("zotero-itemmenu-addontop");
  registerFallbackPopupMenuItem(win, itemMenu, "zco-item-menu", "输出到 Obsidian", icon, () => scheduleExport(win));

  return Boolean(itemMenu);
}

function observeFallbackMenuRoots(win: ZoteroMainWindow, rootURI?: string): void {
  if (fallbackObservers.has(win)) return;
  const mutationObserver = (win as any).MutationObserver ?? (globalThis as any).MutationObserver;
  const target = doc(win).body ?? doc(win).documentElement;
  if (!mutationObserver || !target) return;
  const observer = new mutationObserver(() => {
    if (registerVisibleFallbackMenus(win, rootURI)) {
      observer.disconnect();
      fallbackObservers.delete(win);
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  fallbackObservers.set(win, observer);
  debug("Waiting for legacy Zotero context menu DOM nodes.");
}

export function registerZcoMenus(win: ZoteroMainWindow, rootURI?: string): void {
  debug(`Registering menus for window: ${doc(win).location?.href ?? "unknown"}`);
  registerMainWindowLocale(win);
  registerVisibleMenuDedupers(win);
  const menuManagerRegistered = registerZcoMenuManager(win, rootURI);
  if (!menuManagerRegistered && !registerVisibleFallbackMenus(win, rootURI)) {
    observeFallbackMenuRoots(win, rootURI);
  }
}

export function unregisterZcoMenuManager(): void {
  const menuManager = (Zotero as any).MenuManager;
  if (registeredMenuIDs.length > 0 && menuManager?.unregisterMenu) {
    for (const registeredMenuID of registeredMenuIDs) {
      try {
        menuManager.unregisterMenu(registeredMenuID);
      } catch (error) {
        debug(`MenuManager unregister failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  registeredMenuIDs = [];
}

export function unregisterZcoMenus(win: ZoteroMainWindow): void {
  unregisterZcoMenuManager();
  unregisterMainWindowLocale(win);
  for (const { element, handler } of fallbackPopupListeners.get(win) ?? []) {
    element.removeEventListener?.("popupshowing", handler);
  }
  fallbackPopupListeners.delete(win);
  fallbackRegisteredIDs.delete(win);
  fallbackDedupedPopups.delete(win);
  fallbackObservers.get(win)?.disconnect();
  fallbackObservers.delete(win);
  for (const id of FALLBACK_MENU_IDS) {
    doc(win).getElementById(id)?.remove();
  }
}
