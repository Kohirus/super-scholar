import { afterEach, describe, expect, it, vi } from "vitest";
import { onMainWindowLoad as pluginOnMainWindowLoad } from "../src/index";
import { shutdownPlugin, startupPlugin } from "../src/hooks";
import { registerZcoMenus, unregisterZcoMenuManager } from "../src/ui/menu";

describe("ZCO menu registration", () => {
  afterEach(() => {
    unregisterZcoMenuManager();
    vi.unstubAllGlobals();
  });

  it("waits for Zotero UI readiness before registering menus during startup", async () => {
    let resolveInitialization!: () => void;
    let resolveUnlock!: () => void;
    let resolveUiReady!: () => void;
    const registerMenu = vi.fn((..._args: any[]) => "registered-menu-id");
    const registerEventListener = vi.fn();
    const elements = new Map<string, any>();
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn(),
    };
    const win = {
      document,
      MozXULElement: { insertFTLIfNeeded: vi.fn() },
    };
    vi.stubGlobal("Zotero", {
      initializationPromise: new Promise<void>((resolve) => {
        resolveInitialization = resolve;
      }),
      unlockPromise: new Promise<void>((resolve) => {
        resolveUnlock = resolve;
      }),
      uiReadyPromise: new Promise<void>((resolve) => {
        resolveUiReady = resolve;
      }),
      getMainWindows: vi.fn(() => [win]),
      MenuManager: {
        registerMenu,
        unregisterMenu: vi.fn(),
      },
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
      },
    });

    const startup = startupPlugin(
      {
        id: "super-scholar@Kohirus",
        version: "0.1.1",
        rootURI: "file:///plugin/",
      },
      0,
    );
    await Promise.resolve();

    expect(Zotero.getMainWindows).not.toHaveBeenCalled();
    expect(registerMenu).not.toHaveBeenCalled();
    resolveInitialization();
    resolveUnlock();
    resolveUiReady();
    await startup;

    expect(Zotero.getMainWindows).toHaveBeenCalled();
    expect(registerMenu).not.toHaveBeenCalled();
    expect(registerEventListener).toHaveBeenCalledWith(
      "createViewContextMenu",
      expect.any(Function),
      "super-scholar@Kohirus",
    );
  });

  it("uses a legacy library item menu even when MenuManager is available", async () => {
    const registerMenu = vi.fn((..._args: any[]) => "registered-menu-id");
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    vi.stubGlobal("Zotero", {
      initializationPromise: Promise.resolve(),
      unlockPromise: Promise.resolve(),
      uiReadyPromise: Promise.resolve(),
      getMainWindows: vi.fn(() => []),
      MenuManager: {
        registerMenu,
        unregisterMenu: vi.fn(),
      },
    });

    registerZcoMenus({
      document: {
        getElementById: vi.fn((id: string) => elements.get(id) ?? null),
        createXULElement: vi.fn((tag: string) => ({
          tag,
          attributes: new Map<string, string>(),
          setAttribute(name: string, value: string) {
            this.attributes.set(name, value);
            if (name === "id") {
              elements.set(value, this);
            }
          },
          addEventListener: vi.fn(),
        })),
      },
      MozXULElement: { insertFTLIfNeeded: vi.fn() },
    } as unknown as ZoteroMainWindow);

    expect(registerMenu).not.toHaveBeenCalled();
    expect(appended).toHaveLength(1);
    expect((appended[0] as any).attributes.get("label")).toBe("输出到 Obsidian");
    expect((appended[0] as any).attributes.get("image")).toBe("content/icons/logo.svg");

    shutdownPlugin(
      {
        id: "super-scholar@Kohirus",
        version: "0.1.1",
        rootURI: "file:///plugin/",
      },
      0,
    );
  });

  it("defers legacy menu commands until after the menu command event returns", () => {
    const setTimeout = vi.fn();
    const appended: any[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: any) => appended.push(element)),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {});

    registerZcoMenus({
      document,
      setTimeout,
      MozXULElement: { insertFTLIfNeeded: vi.fn() },
    } as unknown as ZoteroMainWindow);

    const command = appended[0].addEventListener.mock.calls.find(([event]: [string]) => event === "command")?.[1];
    command?.();

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it("removes stale plugin MenuManager registrations before registering the library item menu", () => {
    const unregisterByPluginID = vi.fn();
    const registerMenu = vi.fn((..._args: any[]) => "registered-menu-id");
    vi.stubGlobal("Zotero", {
      MenuManager: {
        _unregisterByPluginID: unregisterByPluginID,
        registerMenu,
        unregisterMenu: vi.fn(),
      },
    });

    registerZcoMenus({
      document: {
        getElementById: vi.fn(() => null),
      },
      MozXULElement: { insertFTLIfNeeded: vi.fn() },
    } as unknown as ZoteroMainWindow);

    expect(unregisterByPluginID).toHaveBeenCalledWith("super-scholar@Kohirus");
    expect(registerMenu).not.toHaveBeenCalled();
  });

  it("does not register a MenuManager Tools menu entry", () => {
    const registerMenu = vi.fn((..._args: any[]) => `registered-menu-id-${registerMenu.mock.calls.length}`);
    vi.stubGlobal("Zotero", {
      MenuManager: {
        registerMenu,
        unregisterMenu: vi.fn(),
      },
    });

    registerZcoMenus({
      document: {
        getElementById: vi.fn(() => null),
      },
      MozXULElement: { insertFTLIfNeeded: vi.fn() },
    } as unknown as ZoteroMainWindow);

    expect(registerMenu).not.toHaveBeenCalled();
    expect(registerMenu).not.toHaveBeenCalledWith(
      expect.objectContaining({
        target: "main/menubar/tools",
      }),
    );
  });

  it("appends a legacy popup menu item even when MenuManager is available", () => {
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {
      MenuManager: {
        registerMenu: vi.fn(() => "registered-menu-id"),
      },
    });

    registerZcoMenus({ document } as unknown as ZoteroMainWindow);

    expect(itemMenu.addEventListener).toHaveBeenCalledWith("popupshowing", expect.any(Function));
    expect(appended).toHaveLength(1);
  });

  it("registers a popupshowing fallback when MenuManager is unavailable", () => {
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {});

    registerZcoMenus({ document } as unknown as ZoteroMainWindow);
    const popupHandler = itemMenu.addEventListener.mock.calls.find(([event]) => event === "popupshowing")?.[1];
    popupHandler?.();

    expect(itemMenu.addEventListener).toHaveBeenCalledWith("popupshowing", expect.any(Function));
    expect(appended).toHaveLength(1);
    expect((appended[0] as any).attributes.get("label")).toBe("输出到 Obsidian");
    expect((appended[0] as any).attributes.get("image")).toBe("content/icons/logo.svg");
  });

  it("does not append duplicate fallback items when popup children are not found by document id lookup", () => {
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
      querySelector: vi.fn((selector: string) => {
        if (selector !== "#zco-item-menu") return null;
        return appended.find((element) => (element as any).attributes.get("id") === "zco-item-menu") ?? null;
      }),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {});

    registerZcoMenus({ document } as unknown as ZoteroMainWindow);
    const popupHandler = itemMenu.addEventListener.mock.calls.find(([event]) => event === "popupshowing")?.[1];
    popupHandler?.();
    popupHandler?.();

    expect(appended).toHaveLength(1);
  });

  it("deduplicates stale fallback menu items left by older popupshowing listeners", () => {
    const appended: any[] = [];
    const itemMenu = {
      children: appended,
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: any) => {
        appended.push(element);
        return element;
      }),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        removed: false,
        attributes: new Map<string, string>(),
        getAttribute(name: string) {
          return this.attributes.get(name) ?? null;
        },
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
        },
        addEventListener: vi.fn(),
        remove() {
          this.removed = true;
          const index = appended.indexOf(this);
          if (index >= 0) appended.splice(index, 1);
        },
      })),
    };
    vi.stubGlobal("Zotero", {});

    registerZcoMenus({ document } as unknown as ZoteroMainWindow);
    const popupShowingHandlers = itemMenu.addEventListener.mock.calls
      .filter(([event]) => event === "popupshowing")
      .map(([, handler]) => handler);
    const staleDuplicate = document.createXULElement("menuitem");
    staleDuplicate.setAttribute("id", "zco-item-menu");
    staleDuplicate.setAttribute("label", "输出到 Obsidian");
    appended.push(staleDuplicate);

    for (const handler of popupShowingHandlers) {
      handler();
    }

    expect(appended.filter((element) => element.attributes.get("label") === "输出到 Obsidian")).toHaveLength(1);
    expect(staleDuplicate.removed).toBe(true);
  });

  it("inserts the main-window Fluent file before registering MenuManager menus", () => {
    const insertFTLIfNeeded = vi.fn();
    const elements = new Map<string, any>();
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {
      MenuManager: {
        registerMenu: vi.fn(() => "registered-menu-id"),
      },
    });

    registerZcoMenus({ document, MozXULElement: { insertFTLIfNeeded } } as unknown as ZoteroMainWindow);

    expect(insertFTLIfNeeded).toHaveBeenCalledWith("zotero-codex-obsidian.ftl");
  });

  it("accepts Zotero onMainWindowLoad callbacks that pass the window directly", () => {
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
    };
    const elements = new Map<string, any>([["zotero-itemmenu", itemMenu]]);
    const document = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {
      MenuManager: {
        registerMenu: vi.fn(() => "registered-menu-id"),
      },
      getMainWindows: vi.fn(() => []),
    });

    pluginOnMainWindowLoad({ document } as unknown as ZoteroMainWindow);

    expect(itemMenu.appendChild).toHaveBeenCalled();
  });

  it("waits for the legacy Zotero item menu when the main window DOM is still initializing", () => {
    const appended: Element[] = [];
    const itemMenu = {
      addEventListener: vi.fn(),
      appendChild: vi.fn((element: Element) => appended.push(element)),
    };
    const elements = new Map<string, any>();
    let observerCallback: (() => void) | undefined;
    class MutationObserver {
      constructor(callback: () => void) {
        observerCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const document = {
      body: {},
      documentElement: {},
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      createXULElement: vi.fn((tag: string) => ({
        tag,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
          if (name === "id") {
            elements.set(value, this);
          }
        },
        addEventListener: vi.fn(),
      })),
    };
    vi.stubGlobal("Zotero", {});

    registerZcoMenus({ document, MutationObserver } as unknown as ZoteroMainWindow);
    elements.set("zotero-itemmenu", itemMenu);
    observerCallback?.();

    expect(itemMenu.appendChild).toHaveBeenCalled();
    expect((appended[0] as any).attributes.get("label")).toBe("输出到 Obsidian");
  });
});
