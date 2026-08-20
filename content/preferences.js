(function () {
var ZCO_PREF_PREFIX = "extensions.zotero-codex-obsidian.";

var ZcoPreferences = {
  initialized: false,

  init(doc) {
    if (this.initialized) {
      return true;
    }

    var root = doc.getElementById("zco-preferences");
    var mineruButton = doc.getElementById("zco-test-mineru");
    if (!root || !mineruButton) {
      return false;
    }

    this.initialized = true;
    this.doc = doc;
    this.modeInput = doc.getElementById("zco-mineru-mode");
    this.modeTabs = doc.querySelectorAll
      ? Array.from(doc.querySelectorAll("[data-zco-mineru-mode-tab]"))
      : [];
    this.localSettings = doc.getElementById("zco-mineru-local-settings");
    this.cloudSettings = doc.getElementById("zco-mineru-cloud-settings");
    this.mineruStatus = doc.getElementById("zco-test-status");

    this.modeTabs.forEach((tab) => {
      const mode = tab.getAttribute
        ? tab.getAttribute("data-zco-mineru-mode-tab")
        : tab.dataset?.zcoMineruModeTab;
      this.bindCommand(tab, () => this.activateMineruMode(mode));
    });
    this.bindCommand(mineruButton, () => this.testMineru());
    this.updateMineruModeVisibility();
    return true;
  },

  bindCommand(element, handler) {
    element.addEventListener("click", handler);
    element.addEventListener("command", handler);
  },

  getPref(name, fallback = "") {
    const value = Zotero.Prefs.get(`${ZCO_PREF_PREFIX}${name}`, true);
    return value === undefined || value === null ? fallback : value;
  },

  setPref(name, value) {
    Zotero.Prefs.set(`${ZCO_PREF_PREFIX}${name}`, value, true);
  },

  getValue(id, prefName, fallback = "") {
    const element = this.doc?.getElementById(id);
    const value = element && "value" in element ? element.value : undefined;
    return value === undefined || value === null || value === "" ? String(this.getPref(prefName, fallback)) : String(value);
  },

  currentMineruMode() {
    return this.getValue("zco-mineru-mode", "mineru.mode", "local") === "cloud" ? "cloud" : "local";
  },

  setMineruStatus(message) {
    if (this.mineruStatus) {
      this.mineruStatus.textContent = message;
    }
  },

  updateMineruModeVisibility() {
    const mode = this.currentMineruMode();
    this.modeTabs?.forEach((tab) => {
      const tabMode = tab.getAttribute
        ? tab.getAttribute("data-zco-mineru-mode-tab")
        : tab.dataset?.zcoMineruModeTab;
      const selected = tabMode === mode;
      tab.setAttribute("aria-selected", String(selected));
      tab.classList.toggle("is-selected", selected);
    });
    if (this.localSettings) {
      this.localSettings.hidden = mode !== "local";
    }
    if (this.cloudSettings) {
      this.cloudSettings.hidden = mode !== "cloud";
    }
  },

  activateMineruMode(mode) {
    if (mode !== "local" && mode !== "cloud") {
      return;
    }
    if (this.modeInput) {
      this.modeInput.value = mode;
      this.modeInput.dispatchEvent(new Event("input", { bubbles: true }));
      this.modeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    this.setPref("mineru.mode", mode);
    this.updateMineruModeVisibility();
  },

  async testMineru() {
    const mode = this.currentMineruMode();
    this.setMineruStatus("Testing...");
    try {
      if (mode === "cloud") {
        const base = this.getValue("zco-mineru-cloud-api-base", "mineru.cloudApiBase", "https://mineru.net/api/v4").replace(/\/+$/, "");
        const key = this.getValue("zco-mineru-cloud-api-key", "mineru.cloudApiKey", "").trim();
        if (!key) {
          throw new Error("Online MinerU API key is required");
        }
        const response = await fetch(`${base}/extract-results/batch/_test`, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed");
        }
      } else {
        const base = this.getValue("zco-mineru-local-api-base", "mineru.localApiBase", "http://127.0.0.1:8000").replace(/\/+$/, "");
        const response = await fetch(`${base}/health`, { method: "GET" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }
      this.setMineruStatus("MinerU connection test succeeded.");
    } catch (error) {
      this.setMineruStatus(`MinerU connection test failed: ${error.message || error}`);
    }
  },

};

window.ZcoPreferences = ZcoPreferences;

function scheduleZcoPreferencesInit() {
  const tryInit = () => ZcoPreferences.init(document);
  if (tryInit()) {
    return;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!tryInit()) {
        observePreferencePane();
      }
    }, { once: true });
    return;
  }
  observePreferencePane();
}

function observePreferencePane() {
  const target = document.body || document.documentElement;
  if (typeof MutationObserver === "undefined" || !target) {
    let attempts = 0;
    const retry = () => {
      if (ZcoPreferences.init(document) || attempts >= 20) {
        return;
      }
      attempts += 1;
      setTimeout(retry, 100);
    };
    setTimeout(retry, 0);
    return;
  }
  const observer = new MutationObserver(() => {
    if (ZcoPreferences.init(document)) {
      observer.disconnect();
    }
  });
  observer.observe(target, { childList: true, subtree: true });
}

scheduleZcoPreferencesInit();
})();
