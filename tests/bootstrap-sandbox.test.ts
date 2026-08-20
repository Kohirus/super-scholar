import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("bootstrap sandbox", () => {
  it("loads the bundled runtime even when optional browser globals are unavailable", async () => {
    const bootstrap = readFileSync(resolve(import.meta.dirname, "..", "bootstrap.js"), "utf8");
    const bundleStartup = vi.fn(async () => undefined);
    const loadSubScript = vi.fn((_url: string, scope: any) => {
      scope.ZoteroCodexObsidian = { startup: bundleStartup };
    });
    const context = {
      setTimeout,
      clearTimeout,
      URL,
      Blob,
      Zotero: {
        debug: vi.fn(),
        PreferencePanes: { register: vi.fn() },
      },
      Services: {
        scriptloader: { loadSubScript },
      },
      Cc: {},
      Ci: {},
      ChromeUtils: {},
    };

    vm.runInNewContext(bootstrap, context);
    await (context as any).startup(
      {
        id: "super-scholar@Kohirus",
        version: "0.1.1",
        rootURI: "file:///plugin/",
      },
      0,
    );

    expect(loadSubScript).toHaveBeenCalledWith("file:///plugin/content/index.js", expect.any(Object));
    expect(bundleStartup).toHaveBeenCalled();
  });
});
