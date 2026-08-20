var zcoScope = {};
var zcoFallbackConsole = {
  warn: function () {},
  error: function () {},
  log: function () {},
};

function zcoGlobal(name, fallback) {
  try {
    if (typeof globalThis !== "undefined" && typeof globalThis[name] !== "undefined") {
      return globalThis[name];
    }
  } catch (_) {
    // Reading globals is best effort only in bootstrap sandboxes.
  }
  return fallback;
}

function zcoDebug(message, error) {
  try {
    zcoGlobal("console", zcoFallbackConsole).warn("[ZCO] " + message, error || "");
  } catch (_) {
    // Console logging is best effort only.
  }
  try {
    Zotero.debug("[ZCO] " + message);
  } catch (_) {
    // Zotero debug logging is best effort only.
  }
}

function loadBundle(rootURI) {
  if (zcoScope.ZoteroCodexObsidian) {
    zcoDebug("Reusing loaded bundle.");
    return zcoScope.ZoteroCodexObsidian;
  }
  zcoDebug("Loading bundle from " + rootURI + "content/index.js");
  zcoScope = {
    console: zcoGlobal("console", zcoFallbackConsole),
    setTimeout: zcoGlobal("setTimeout"),
    clearTimeout: zcoGlobal("clearTimeout"),
    URL: zcoGlobal("URL"),
    Blob: zcoGlobal("Blob"),
    FormData: zcoGlobal("FormData"),
    Headers: zcoGlobal("Headers"),
    AbortController: zcoGlobal("AbortController"),
    crypto: zcoGlobal("crypto"),
    Zotero,
    Services,
    Cc,
    Ci,
    ChromeUtils,
    IOUtils: zcoGlobal("IOUtils"),
  };
  Services.scriptloader.loadSubScript(rootURI + "content/index.js", zcoScope);
  if (!zcoScope.ZoteroCodexObsidian) {
    zcoDebug("Bundle loaded but ZoteroCodexObsidian export is missing.");
  }
  return zcoScope.ZoteroCodexObsidian;
}

function registerPreferencePane(data) {
  zcoDebug("Registering preference pane for " + data.id);
  Zotero.PreferencePanes.register({
    pluginID: data.id,
    src: data.rootURI + "content/preferences.xhtml",
    scripts: [data.rootURI + "content/preferences.js"],
    stylesheets: [data.rootURI + "content/preferences.css"],
    label: "super-scholar",
    image: data.rootURI + "content/icons/logo.svg",
  });
}

function startup(data, reason) {
  zcoDebug("bootstrap startup called for " + data.id + " " + data.version);
  try {
    registerPreferencePane(data);
    var bundle = loadBundle(data.rootURI);
    return Promise.resolve(bundle.startup(data, reason)).then(
      function () {
        zcoDebug("bootstrap startup completed.");
      },
      function (error) {
        zcoDebug("bootstrap startup failed.", error);
        throw error;
      },
    );
  } catch (error) {
    zcoDebug("bootstrap startup threw synchronously.", error);
    throw error;
  }
}

function shutdown(data, reason) {
  if (zcoScope.ZoteroCodexObsidian) {
    zcoScope.ZoteroCodexObsidian.shutdown(data, reason);
  }
  zcoScope = {};
}

function install(data, reason) {
  if (zcoScope.ZoteroCodexObsidian?.install) {
    zcoScope.ZoteroCodexObsidian.install(data, reason);
  }
}

function uninstall(data, reason) {
  if (zcoScope.ZoteroCodexObsidian?.uninstall) {
    zcoScope.ZoteroCodexObsidian.uninstall(data, reason);
  }
}

function onMainWindowLoad(data) {
  if (zcoScope.ZoteroCodexObsidian?.onMainWindowLoad) {
    zcoScope.ZoteroCodexObsidian.onMainWindowLoad(data);
  }
}

function onMainWindowUnload(data) {
  if (zcoScope.ZoteroCodexObsidian?.onMainWindowUnload) {
    zcoScope.ZoteroCodexObsidian.onMainWindowUnload(data);
  }
}
