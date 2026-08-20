import type { MineruCloudModel, MineruLocalBackend, MineruMode, MineruSettings } from "./types/mineru";

export const PREF_PREFIX = "extensions.zotero-codex-obsidian.";

export type ObsidianSettings = {
  notesDir: string;
};

export type ZcoSettings = {
  mineru: MineruSettings;
  obsidian: ObsidianSettings;
};

export const DEFAULT_ZCO_SETTINGS: ZcoSettings = {
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
};

export type ZcoPrefReader = {
  getString(name: string): string | undefined;
  getBoolean(name: string): boolean | undefined;
};

export type ZcoPrefStore = ZcoPrefReader & {
  setString(name: string, value: string): void;
  setBoolean(name: string, value: boolean): void;
};

export function normalizeMineruLocalApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_ZCO_SETTINGS.mineru.localApiBase;
}

function normalizeMineruCloudApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_ZCO_SETTINGS.mineru.cloudApiBase;
}

function toMineruMode(value: string | undefined): MineruMode {
  return value === "cloud" ? "cloud" : "local";
}

function toLocalBackend(value: string | undefined): MineruLocalBackend {
  return value === "vlm" || value === "hybrid" ? value : "pipeline";
}

function toCloudModel(value: string | undefined): MineruCloudModel {
  return value === "ocr" || value === "txt" ? value : "auto";
}

function readString(prefs: ZcoPrefReader, name: string, fallback = ""): string {
  return prefs.getString(name)?.trim() ?? fallback;
}

export function readZcoSettingsFromPrefs(prefs: ZcoPrefReader): ZcoSettings {
  return {
    mineru: {
      mode: toMineruMode(prefs.getString("mineru.mode")),
      localApiBase: normalizeMineruLocalApiBase(readString(prefs, "mineru.localApiBase")),
      localBackend: toLocalBackend(prefs.getString("mineru.localBackend")),
      cloudApiBase: normalizeMineruCloudApiBase(readString(prefs, "mineru.cloudApiBase")),
      cloudApiKey: readString(prefs, "mineru.cloudApiKey"),
      cloudModel: toCloudModel(prefs.getString("mineru.cloudModel")),
      forceOcr: prefs.getBoolean("mineru.forceOcr") ?? DEFAULT_ZCO_SETTINGS.mineru.forceOcr,
    },
    obsidian: {
      notesDir: readString(prefs, "obsidian.notesDir"),
    },
  };
}

export function writeZcoSettingsToPrefs(prefs: ZcoPrefStore, settings: ZcoSettings): void {
  prefs.setString("mineru.mode", settings.mineru.mode);
  prefs.setString("mineru.localApiBase", normalizeMineruLocalApiBase(settings.mineru.localApiBase));
  prefs.setString("mineru.localBackend", settings.mineru.localBackend);
  prefs.setString("mineru.cloudApiBase", normalizeMineruCloudApiBase(settings.mineru.cloudApiBase));
  prefs.setString("mineru.cloudApiKey", settings.mineru.cloudApiKey.trim());
  prefs.setString("mineru.cloudModel", settings.mineru.cloudModel);
  prefs.setBoolean("mineru.forceOcr", settings.mineru.forceOcr);
  prefs.setString("obsidian.notesDir", settings.obsidian.notesDir.trim());
}

export function createZoteroPrefStore(zotero: {
  Prefs: {
    get(name: string, global?: boolean): unknown;
    set(name: string, value: string | boolean, global?: boolean): unknown;
  };
}): ZcoPrefStore {
  return {
    getString(name) {
      const value = zotero.Prefs.get(PREF_PREFIX + name, true);
      return typeof value === "string" ? value : undefined;
    },
    getBoolean(name) {
      const value = zotero.Prefs.get(PREF_PREFIX + name, true);
      return typeof value === "boolean" ? value : undefined;
    },
    setString(name, value) {
      zotero.Prefs.set(PREF_PREFIX + name, value, true);
    },
    setBoolean(name, value) {
      zotero.Prefs.set(PREF_PREFIX + name, value, true);
    },
  };
}
