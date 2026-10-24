import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ZCO_SETTINGS,
  createZoteroPrefStore,
  normalizeMineruLocalApiBase,
  readZcoSettingsFromPrefs,
  writeZcoSettingsToPrefs,
} from "../src/settings";

describe("ZCO settings", () => {
  it("uses MinerU and Obsidian-only defaults", () => {
    expect(DEFAULT_ZCO_SETTINGS).toMatchObject({
      mineru: {
        mode: "local",
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline",
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "",
        cloudModel: "auto",
        forceOcr: false,
      },
      obsidian: {
        notesDir: "",
      },
      pdf: {
        excludeFilenameGlob: "",
      },
    });
    expect(JSON.stringify(DEFAULT_ZCO_SETTINGS)).not.toMatch(/chatgpt|openai|templatePath/i);
  });

  it("normalizes MinerU API bases without trailing slashes", () => {
    expect(normalizeMineruLocalApiBase("http://localhost:8000///")).toBe("http://localhost:8000");
    expect(normalizeMineruLocalApiBase("  ")).toBe("http://127.0.0.1:8000");
  });

  it("reads and writes Zotero preferences without leaking keys into other namespaces", () => {
    const values = new Map<string, string | boolean>();
    const store = createZoteroPrefStore({
      Prefs: {
        get: vi.fn((name: string) => values.get(name)),
        set: vi.fn((name: string, value: string | boolean) => {
          values.set(name, value);
        }),
      },
    });

    writeZcoSettingsToPrefs(store, {
      mineru: {
        mode: "cloud",
        localApiBase: "http://mineru.local:9000/",
        localBackend: "hybrid",
        cloudApiBase: "https://mineru.example/api/v4/",
        cloudApiKey: "mineru-secret",
        cloudModel: "ocr",
        forceOcr: true,
      },
      obsidian: {
        notesDir: "D:/Vault/Papers",
      },
      pdf: {
        excludeFilenameGlob: "  *-dual  ",
      },
    });

    expect(readZcoSettingsFromPrefs(store)).toEqual({
      mineru: {
        mode: "cloud",
        localApiBase: "http://mineru.local:9000",
        localBackend: "hybrid",
        cloudApiBase: "https://mineru.example/api/v4",
        cloudApiKey: "mineru-secret",
        cloudModel: "ocr",
        forceOcr: true,
      },
      obsidian: {
        notesDir: "D:/Vault/Papers",
      },
      pdf: {
        excludeFilenameGlob: "*-dual",
      },
    });
    expect([...values.keys()].every((key) => key.startsWith("extensions.zotero-codex-obsidian."))).toBe(true);
    expect([...values.keys()].some((key) => /chatgpt|openai/i.test(key))).toBe(false);
  });
});
