import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerZcoPreferencePane } from "../src/ui/preferencePane";

const root = resolve(import.meta.dirname, "..");

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(root, ...parts), "utf8");
}

function fluentShape(source: string): Map<string, string[]> {
  const shape = new Map<string, string[]>();
  let current = "";
  for (const line of source.split(/\r?\n/)) {
    const message = /^([a-z0-9-]+)\s*=/.exec(line);
    if (message?.[1]) {
      current = message[1];
      shape.set(current, []);
      continue;
    }
    const attribute = /^\s+\.([a-z-]+)\s*=/.exec(line);
    if (current && attribute?.[1]) shape.get(current)?.push(attribute[1]);
  }
  return shape;
}

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
    expect(pane).toContain(
      'preference="extensions.zotero-codex-obsidian.pdf.excludeFilenameGlob"',
    );
    expect(pane).toContain('id="zco-pdf-exclude-filename-glob"');
    expect(pane).toContain('data-l10n-id="zco-pref-pdf-filter-help"');
    expect(pane).not.toContain('preference="extensions.zotero-codex-obsidian.note.templatePath"');
    expect(pane).toContain('data-zco-mineru-mode-tab="local"');
    expect(pane).toContain('data-zco-mineru-mode-tab="cloud"');
    expect(pane).toContain("zco-test-mineru");
    expect(pane).not.toMatch(/chatgpt|openai|template/i);
    expect(pane).not.toContain("onload=");
  });

  it("uses complete, key-compatible English and Chinese Fluent resources for visible copy", () => {
    const pane = readProjectFile("content", "preferences.xhtml");
    const english = readProjectFile("locale", "en-US", "zotero-codex-obsidian.ftl");
    const chinese = readProjectFile("locale", "zh-CN", "zotero-codex-obsidian.ftl");
    const englishShape = fluentShape(english);
    const chineseShape = fluentShape(chinese);
    const localizationIds = [...pane.matchAll(/data-l10n-id="([^"]+)"/g)].map((match) => match[1]!);

    expect(localizationIds.length).toBeGreaterThan(15);
    expect([...englishShape.entries()]).toEqual([...chineseShape.entries()]);
    for (const id of localizationIds) {
      expect(englishShape.has(id), `missing English Fluent key ${id}`).toBe(true);
      expect(chineseShape.has(id), `missing Chinese Fluent key ${id}`).toBe(true);
    }
    expect(pane).not.toMatch(/>\s*(?:Configure|Local service|Online service|Local backend|Force OCR|Test MinerU|Notes directory|PDF filtering|Attachment title exclusion glob|Use \*)/);
    expect(english).toContain("Configure MinerU parsing and Obsidian export paths.");
    expect(chinese).toContain("配置 MinerU 解析与 Obsidian 导出路径。");
    expect(english).toContain(".placeholder = D:\\Vault\\Papers");
    expect(chinese).toContain(".placeholder = D:\\Vault\\Papers");
  });

  it("localizes delayed connection-test status and a cloud username through document.l10n", async () => {
    const script = readProjectFile("content", "preferences.js");
    const status = { textContent: "" };
    const elements = new Map<string, any>([
      ["zco-preferences", {}],
      ["zco-test-mineru", { addEventListener: vi.fn() }],
      ["zco-test-status", status],
      ["zco-mineru-local-settings", { hidden: false }],
      ["zco-mineru-cloud-settings", { hidden: true }],
    ]);
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const formatValue = vi.fn(async (id: string, args?: Record<string, unknown>) =>
      args?.user ? `${id}:${args.user}` : id,
    );
    const document = {
      readyState: "complete",
      l10n: { ready, formatValue, translateFragment: vi.fn() },
      defaultView: { MozXULElement: { insertFTLIfNeeded: vi.fn() } },
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      body: {},
    };
    const prefs = new Map<string, unknown>([
      ["extensions.zotero-codex-obsidian.mineru.mode", "cloud"],
      ["extensions.zotero-codex-obsidian.mineru.cloudApiBase", "https://mineru.example/api/v4"],
      ["extensions.zotero-codex-obsidian.mineru.cloudApiKey", "secret"],
    ]);
    const context = {
      document,
      window: {},
      Zotero: { Prefs: { get: (key: string) => prefs.get(key), set: vi.fn() } },
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { username: "alice" } }),
      })),
      setTimeout: vi.fn(),
      MutationObserver: undefined,
    };

    vm.runInNewContext(script, context);
    const testPromise = (context.window as any).ZcoPreferences.testMineru();
    await Promise.resolve();
    expect(formatValue).not.toHaveBeenCalled();
    resolveReady();
    await testPromise;

    expect(formatValue.mock.calls).toEqual([
      ["zco-pref-status-testing", undefined],
      ["zco-pref-status-success-user", { user: "alice" }],
    ]);
    expect(status.textContent).toBe("zco-pref-status-success-user:alice");
  });

  it("retries static and dynamic localization when Fluent appears after initialization", async () => {
    const script = readProjectFile("content", "preferences.js");
    const rootElement = {};
    const status = { textContent: "" };
    const elements = new Map<string, any>([
      ["zco-preferences", rootElement],
      ["zco-test-mineru", { addEventListener: vi.fn() }],
      ["zco-test-status", status],
      ["zco-mineru-local-settings", { hidden: false }],
      ["zco-mineru-cloud-settings", { hidden: true }],
    ]);
    const pendingTimers: Array<() => unknown> = [];
    const insertFTLIfNeeded = vi.fn();
    const document: any = {
      readyState: "complete",
      defaultView: { MozXULElement: { insertFTLIfNeeded } },
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      body: {},
    };
    const prefs = new Map<string, unknown>([
      ["extensions.zotero-codex-obsidian.mineru.mode", "local"],
      ["extensions.zotero-codex-obsidian.mineru.localApiBase", "http://127.0.0.1:8000"],
    ]);
    const context = {
      document,
      window: {},
      Zotero: { Prefs: { get: (key: string) => prefs.get(key), set: vi.fn() } },
      fetch: vi.fn(async () => ({ ok: true, status: 200 })),
      setTimeout: vi.fn((callback: () => unknown) => {
        pendingTimers.push(callback);
        return pendingTimers.length;
      }),
      MutationObserver: undefined,
    };

    vm.runInNewContext(script, context);
    await (context.window as any).ZcoPreferences.testMineru();

    expect(status.textContent).toBe("MinerU connection test succeeded.");
    const translateFragment = vi.fn(async () => undefined);
    const formatValue = vi.fn(async (id: string) =>
      id === "zco-pref-status-success" ? "MinerU 连接测试成功。" : id,
    );
    document.l10n = { ready: Promise.resolve(), translateFragment, formatValue };
    await Promise.all(pendingTimers.splice(0).map((callback) => callback()));

    expect(insertFTLIfNeeded).toHaveBeenCalled();
    expect(translateFragment).toHaveBeenCalledWith(rootElement);
    expect(formatValue).toHaveBeenCalledWith("zco-pref-status-success", undefined);
    expect(status.textContent).toBe("MinerU 连接测试成功。");
  });

  it.each([
    ["missing-key", "zco-pref-status-api-key-required"],
    ["auth", "zco-pref-status-auth-failed"],
    ["server", "zco-pref-status-server-failed"],
    ["unexpected", "zco-pref-status-failed"],
  ])("localizes the %s connection-test failure", async (scenario, expectedId) => {
    const script = readProjectFile("content", "preferences.js");
    const status = { textContent: "" };
    const elements = new Map<string, any>([
      ["zco-preferences", {}],
      ["zco-test-mineru", { addEventListener: vi.fn() }],
      ["zco-test-status", status],
      ["zco-mineru-local-settings", { hidden: false }],
      ["zco-mineru-cloud-settings", { hidden: true }],
    ]);
    const formatValue = vi.fn(async (id: string) => id);
    const document = {
      readyState: "complete",
      l10n: { ready: Promise.resolve(), formatValue, translateFragment: vi.fn() },
      defaultView: { MozXULElement: { insertFTLIfNeeded: vi.fn() } },
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      body: {},
    };
    const mode = scenario === "server" || scenario === "unexpected" ? "local" : "cloud";
    const prefs = new Map<string, unknown>([
      ["extensions.zotero-codex-obsidian.mineru.mode", mode],
      ["extensions.zotero-codex-obsidian.mineru.cloudApiBase", "https://mineru.example/api/v4"],
      ["extensions.zotero-codex-obsidian.mineru.cloudApiKey", scenario === "missing-key" ? "" : "secret"],
      ["extensions.zotero-codex-obsidian.mineru.localApiBase", "http://127.0.0.1:8000"],
    ]);
    const fetch =
      scenario === "unexpected"
        ? vi.fn(async () => {
            throw new Error("offline");
          })
        : vi.fn(async () => ({ ok: false, status: scenario === "auth" ? 401 : 503 }));
    const context = {
      document,
      window: {},
      Zotero: { Prefs: { get: (key: string) => prefs.get(key), set: vi.fn() } },
      fetch,
      setTimeout: vi.fn(),
      MutationObserver: undefined,
    };

    vm.runInNewContext(script, context);
    await (context.window as any).ZcoPreferences.testMineru();

    expect(formatValue.mock.calls.at(-1)?.[0]).toBe(expectedId);
    expect(status.textContent).toBe(expectedId);
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
