(function () {
var ZCO_PREF_PREFIX = "extensions.zotero-codex-obsidian.";
var ZCO_STATUS_FALLBACKS = {
  "zco-pref-status-testing": "Testing…",
  "zco-pref-status-success": "MinerU connection test succeeded.",
  "zco-pref-status-success-user": "MinerU connection test succeeded for { $user }.",
  "zco-pref-status-api-key-required": "Online MinerU API key is required.",
  "zco-pref-status-auth-failed": "MinerU authentication failed. Check the API key.",
  "zco-pref-status-server-failed": "MinerU service returned HTTP { $status }.",
  "zco-pref-status-failed": "MinerU connection test failed: { $error }",
};

function zcoFallbackMessage(messageId, variables) {
  return (ZCO_STATUS_FALLBACKS[messageId] || messageId).replace(
    /\{\s*\$([a-zA-Z0-9_-]+)\s*\}/g,
    (_match, name) => String(variables?.[name] ?? ""),
  );
}

function zcoStatusError(messageId, variables) {
  var error = new Error(messageId);
  error.zcoMessageId = messageId;
  error.zcoVariables = variables;
  return error;
}

var ZcoPreferences = {
  initialized: false,
  localizationAttempts: 0,
  localizationRetryScheduled: false,
  statusRevision: 0,
  localizedStatusRevision: 0,
  renderingStatusRevision: 0,

  init(doc) {
    if (this.initialized) {
      this.requestLocalization();
      return true;
    }

    var root = doc.getElementById("zco-preferences");
    var mineruButton = doc.getElementById("zco-test-mineru");
    if (!root || !mineruButton) {
      return false;
    }

    this.initialized = true;
    this.doc = doc;
    this.root = root;
    this.modeInput = doc.getElementById("zco-mineru-mode");
    this.modeTabs = doc.querySelectorAll
      ? Array.from(doc.querySelectorAll("[data-zco-mineru-mode-tab]"))
      : [];
    this.localSettings = doc.getElementById("zco-mineru-local-settings");
    this.cloudSettings = doc.getElementById("zco-mineru-cloud-settings");
    this.mineruStatus = doc.getElementById("zco-test-status");
    this.requestLocalization();

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

  scheduleLocalizationRetry() {
    if (this.localizationRetryScheduled || this.localizationAttempts >= 20) {
      return;
    }
    this.localizationRetryScheduled = true;
    this.localizationAttempts += 1;
    setTimeout(() => {
      this.localizationRetryScheduled = false;
      return this.requestLocalization();
    }, 100);
  },

  async requestLocalization() {
    try {
      var preferenceWindow = this.doc?.defaultView || window;
      preferenceWindow.MozXULElement?.insertFTLIfNeeded?.("zotero-codex-obsidian.ftl");
      var l10n = this.doc?.l10n;
      if (!l10n?.translateFragment || !l10n?.formatValue) {
        this.scheduleLocalizationRetry();
        return;
      }
      await l10n.ready;
      await l10n.translateFragment(this.root);
      this.localizationAttempts = 0;
      await this.renderLatestStatus();
    } catch (_error) {
      this.scheduleLocalizationRetry();
    }
  },

  async renderLatestStatus() {
    var status = this.latestStatus;
    var l10n = this.doc?.l10n;
    if (!status || !l10n?.formatValue) {
      if (status) this.scheduleLocalizationRetry();
      return;
    }
    if (
      this.localizedStatusRevision === status.revision ||
      this.renderingStatusRevision === status.revision
    ) {
      return;
    }
    this.renderingStatusRevision = status.revision;
    try {
      await l10n.ready;
      var message = await l10n.formatValue(status.messageId, status.variables);
      if (this.latestStatus?.revision === status.revision && this.mineruStatus) {
        this.mineruStatus.textContent = message || zcoFallbackMessage(status.messageId, status.variables);
        this.localizedStatusRevision = status.revision;
      }
    } catch (_error) {
      this.scheduleLocalizationRetry();
    } finally {
      if (this.renderingStatusRevision === status.revision) {
        this.renderingStatusRevision = 0;
      }
    }
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

  async setMineruStatus(messageId, variables) {
    this.statusRevision += 1;
    this.latestStatus = { messageId, variables, revision: this.statusRevision };
    if (this.mineruStatus) {
      this.mineruStatus.textContent = zcoFallbackMessage(messageId, variables);
    }
    this.requestLocalization();
    await this.renderLatestStatus();
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
    await this.setMineruStatus("zco-pref-status-testing");
    try {
      var username = "";
      if (mode === "cloud") {
        const base = this.getValue("zco-mineru-cloud-api-base", "mineru.cloudApiBase", "https://mineru.net/api/v4").replace(/\/+$/, "");
        const key = this.getValue("zco-mineru-cloud-api-key", "mineru.cloudApiKey", "").trim();
        if (!key) {
          throw zcoStatusError("zco-pref-status-api-key-required");
        }
        const response = await fetch(`${base}/extract-results/batch/_test`, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });
        if (response.status === 401 || response.status === 403) {
          throw zcoStatusError("zco-pref-status-auth-failed");
        }
        if (!response.ok) {
          throw zcoStatusError("zco-pref-status-server-failed", { status: response.status });
        }
        try {
          const payload = await response.json();
          username = String(payload?.data?.username || payload?.username || "");
        } catch (_error) {
          // Successful health responses do not have to include JSON identity data.
        }
      } else {
        const base = this.getValue("zco-mineru-local-api-base", "mineru.localApiBase", "http://127.0.0.1:8000").replace(/\/+$/, "");
        const response = await fetch(`${base}/health`, { method: "GET" });
        if (!response.ok) {
          throw zcoStatusError("zco-pref-status-server-failed", { status: response.status });
        }
      }
      if (username) {
        await this.setMineruStatus("zco-pref-status-success-user", { user: username });
      } else {
        await this.setMineruStatus("zco-pref-status-success");
      }
    } catch (error) {
      if (error?.zcoMessageId) {
        await this.setMineruStatus(error.zcoMessageId, error.zcoVariables);
      } else {
        await this.setMineruStatus("zco-pref-status-failed", {
          error: error?.message || String(error),
        });
      }
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
