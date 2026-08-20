import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerZcoPreferencePane } from "../src/ui/preferencePane";

describe("ZCO preference pane", () => {
  it("registers a Zotero settings pane during startup", () => {
    const register = vi.fn();

    registerZcoPreferencePane(
      { PreferencePanes: { register } },
      {
        id: "super-scholar@Kohirus",
        rootURI: "file:///plugin/",
      },
    );

    expect(register).toHaveBeenCalledWith({
      pluginID: "super-scholar@Kohirus",
      src: "file:///plugin/content/preferences.xhtml",
      scripts: ["file:///plugin/content/preferences.js"],
      stylesheets: ["file:///plugin/content/preferences.css"],
      label: "super-scholar",
      image: "file:///plugin/content/icons/logo.svg",
    });
  });

  it("contains fields bound only to MinerU and Obsidian preferences", () => {
    const pane = readFileSync(
      resolve(import.meta.dirname, "..", "content", "preferences.xhtml"),
      "utf8",
    );

    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.localApiBase"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.mode"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.localBackend"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.cloudApiBase"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.cloudApiKey"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.cloudModel"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.mineru.forceOcr"');
    expect(pane).toContain('preference="extensions.zotero-codex-obsidian.obsidian.notesDir"');
    expect(pane).not.toContain('preference="extensions.zotero-codex-obsidian.note.templatePath"');
    expect(pane).toContain('data-zco-mineru-mode-tab="local"');
    expect(pane).toContain('data-zco-mineru-mode-tab="cloud"');
    expect(pane).toContain("zco-test-mineru");
    expect(pane).not.toMatch(/chatgpt|openai|template/i);
    expect(pane).not.toContain("onload=");
  });

  it("self-initializes preference JavaScript and binds the MinerU test button", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "..", "content", "preferences.js"),
      "utf8",
    );

    expect(script).toContain("scheduleZcoPreferencesInit");
    expect(script).toContain("zco-test-mineru");
    expect(script).toContain("MutationObserver");
    expect(script).toContain('addEventListener("click"');
    expect(script).not.toMatch(/chatgpt|openai|template/i);
  });

  it("waits for delayed preference pane DOM before binding test buttons", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "..", "content", "preferences.js"),
      "utf8",
    );
    const listeners = new Map<string, () => void>();
    const elements = new Map<string, any>();
    const document = {
      readyState: "complete",
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      addEventListener: vi.fn(),
      body: {},
    };
    let observerCallback: (() => void) | undefined;
    class MutationObserver {
      constructor(callback: () => void) {
        observerCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const context = {
      document,
      window: {},
      Zotero: { Prefs: { get: vi.fn(), set: vi.fn() } },
      fetch: vi.fn(),
      setTimeout: vi.fn(),
      MutationObserver,
    };

    vm.runInNewContext(script, context);
    elements.set("zco-preferences", {});
    elements.set("zco-test-status", { textContent: "" });
    elements.set("zco-test-mineru", {
      addEventListener: vi.fn((event: string, handler: () => void) => listeners.set(`mineru:${event}`, handler)),
    });
    observerCallback?.();

    expect(listeners.has("mineru:click")).toBe(true);
  });

  it("observes XUL documents that do not expose document.body", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "..", "content", "preferences.js"),
      "utf8",
    );
    const listeners = new Map<string, () => void>();
    const elements = new Map<string, any>();
    const documentElement = {};
    const document = {
      readyState: "complete",
      documentElement,
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
    };
    let observedTarget: unknown;
    let observerCallback: (() => void) | undefined;
    class MutationObserver {
      constructor(callback: () => void) {
        observerCallback = callback;
      }
      observe = vi.fn((target: unknown) => {
        observedTarget = target;
      });
      disconnect = vi.fn();
    }
    const context = {
      document,
      window: {},
      Zotero: { Prefs: { get: vi.fn(), set: vi.fn() } },
      fetch: vi.fn(),
      setTimeout: vi.fn(),
      MutationObserver,
    };

    vm.runInNewContext(script, context);
    elements.set("zco-preferences", {});
    elements.set("zco-test-status", { textContent: "" });
    elements.set("zco-mineru-local-settings", { hidden: false });
    elements.set("zco-mineru-cloud-settings", { hidden: true });
    elements.set("zco-test-mineru", {
      addEventListener: vi.fn((event: string, handler: () => void) => listeners.set(`mineru:${event}`, handler)),
    });
    observerCallback?.();

    expect(observedTarget).toBe(documentElement);
    expect(listeners.has("mineru:click")).toBe(true);
  });

  it("hides online MinerU settings by default until the script applies the selected tab", () => {
    const pane = readFileSync(
      resolve(import.meta.dirname, "..", "content", "preferences.xhtml"),
      "utf8",
    );

    expect(pane).toContain('<html:div id="zco-mineru-cloud-settings" hidden="true">');
  });

  it("registers the settings pane from bootstrap startup", () => {
    const bootstrap = readFileSync(
      resolve(import.meta.dirname, "..", "bootstrap.js"),
      "utf8",
    );

    expect(bootstrap).toContain("Zotero.PreferencePanes.register");
    expect(bootstrap).toContain("content/preferences.xhtml");
    expect(bootstrap).toContain("content/icons/logo.svg");
  });
});
