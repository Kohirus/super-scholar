import { afterEach, describe, expect, it, vi } from "vitest";
import { registerZcoReaderMenus, unregisterZcoReaderMenus } from "../src/ui/readerMenu";

describe("ZCO reader menu registration", () => {
  afterEach(() => {
    unregisterZcoReaderMenus();
    vi.unstubAllGlobals();
  });

  it("registers an Export to Obsidian entry in the PDF reader view context menu", () => {
    const registerEventListener = vi.fn();
    vi.stubGlobal("Zotero", {
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
      },
    });

    registerZcoReaderMenus();

    expect(registerEventListener).toHaveBeenCalledWith(
      "createViewContextMenu",
      expect.any(Function),
      "super-scholar@Kohirus",
    );

    const handler = registerEventListener.mock.calls[0]?.[1] as (event: any) => void;
    const append = vi.fn();
    handler({ append, reader: { itemID: 42 } });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "输出到 Obsidian",
        icon: "content/icons/logo.svg",
        onCommand: expect.any(Function),
      }),
    );
  });

  it("removes stale plugin reader listeners before registering a fresh context menu handler", () => {
    const staleHandler = vi.fn((event: any) => {
      event.append?.({ label: "输出到 Obsidian" });
    });
    let listeners: Array<{
      pluginID: string;
      type: string;
      handler: (event: any) => void;
    }> = [
      {
        pluginID: "super-scholar@Kohirus",
        type: "createViewContextMenu",
        handler: staleHandler,
      },
    ];
    const unregisterByPluginID = vi.fn((pluginID: string) => {
      listeners = listeners.filter((listener) => listener.pluginID !== pluginID);
    });
    const registerEventListener = vi.fn((type: string, handler: (event: unknown) => void, pluginID: string) => {
      listeners.push({ pluginID, type, handler });
    });
    vi.stubGlobal("Zotero", {
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
        _unregisterEventListenerByPluginID: unregisterByPluginID,
      },
    });

    registerZcoReaderMenus();

    expect(unregisterByPluginID).toHaveBeenCalledWith("super-scholar@Kohirus");
    expect(listeners).toHaveLength(1);

    const append = vi.fn();
    for (const listener of listeners) {
      listener.handler({ append, reader: { itemID: 42 } });
    }

    expect(append).toHaveBeenCalledTimes(1);
  });
});
