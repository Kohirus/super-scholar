import { afterEach, describe, expect, it, vi } from "vitest";
import { exportPdfAttachmentsToObsidian, showNotification } from "../src/exportWorkflow";
import { registerZcoReaderMenus, unregisterZcoReaderMenus } from "../src/ui/readerMenu";

vi.mock("../src/exportWorkflow", () => ({
  exportPdfAttachmentsToObsidian: vi.fn(),
  showNotification: vi.fn(),
}));

const exportPdfAttachments = vi.mocked(exportPdfAttachmentsToObsidian);
const notify = vi.mocked(showNotification);

describe("ZCO reader menu registration", () => {
  afterEach(() => {
    unregisterZcoReaderMenus();
    vi.clearAllMocks();
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
        label: "Export to Obsidian",
        icon: "content/icons/logo.svg",
        onCommand: expect.any(Function),
      }),
    );
  });

  it("uses a Simplified Chinese reader-menu label", () => {
    const registerEventListener = vi.fn();
    vi.stubGlobal("Zotero", {
      locale: "zh-CN",
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
      },
    });

    registerZcoReaderMenus();
    const handler = registerEventListener.mock.calls[0]?.[1] as (event: any) => void;
    const append = vi.fn();
    handler({ append, reader: { itemID: 42 } });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ label: "输出到 Obsidian" }),
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

  it("handles and logs a rejected reader export command", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registerEventListener = vi.fn();
    const initiatingWindow = {} as ZoteroMainWindow;
    exportPdfAttachments.mockRejectedValueOnce(new Error("boom"));
    vi.stubGlobal("Zotero", {
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
      },
      getMainWindows: () => [initiatingWindow],
    });

    registerZcoReaderMenus();
    const handler = registerEventListener.mock.calls[0]?.[1] as (event: any) => void;
    const append = vi.fn();
    handler({ append, reader: { itemID: 42 } });
    const command = append.mock.calls[0]?.[0]?.onCommand as () => void;
    command();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith("[ZCO] Reader export command failed: boom");
      expect(notify).toHaveBeenCalledWith(initiatingWindow, "super-scholar", "boom");
    });
  });

  it("uses the standalone reader chrome window instead of its content window", () => {
    const registerEventListener = vi.fn();
    const readerWindow = {} as ZoteroMainWindow;
    const mainWindow = {} as ZoteroMainWindow;
    const contentWindow = {} as Window;
    Object.assign(contentWindow, { top: contentWindow });
    exportPdfAttachments.mockResolvedValueOnce({ processed: 1, skipped: 0, failed: 0 });
    vi.stubGlobal("Zotero", {
      Reader: {
        registerEventListener,
        unregisterEventListener: vi.fn(),
      },
      getMainWindows: () => [mainWindow],
    });

    registerZcoReaderMenus();
    const handler = registerEventListener.mock.calls[0]?.[1] as (event: any) => void;
    const append = vi.fn();
    handler({
      append,
      reader: { itemID: 42, _window: readerWindow, _iframeWindow: contentWindow },
    });
    const command = append.mock.calls[0]?.[0]?.onCommand as () => void;
    command();

    expect(exportPdfAttachments).toHaveBeenCalledWith(readerWindow, expect.any(Function));
  });
});
