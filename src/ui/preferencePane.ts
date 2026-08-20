export type ZoteroPreferencePaneRegistrar = {
  PreferencePanes?: {
    register(options: {
      pluginID: string;
      src: string;
      scripts?: string[];
      stylesheets?: string[];
      label?: string;
      image?: string;
    }): void;
  };
};

export type ZcoStartupData = {
  id: string;
  rootURI: string;
};

export function registerZcoPreferencePane(
  zotero: ZoteroPreferencePaneRegistrar,
  data: ZcoStartupData,
): void {
  zotero.PreferencePanes?.register({
    pluginID: data.id,
    src: `${data.rootURI}content/preferences.xhtml`,
    scripts: [`${data.rootURI}content/preferences.js`],
    stylesheets: [`${data.rootURI}content/preferences.css`],
    label: "super-scholar",
    image: `${data.rootURI}content/icons/logo.svg`,
  });
}
