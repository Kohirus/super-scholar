declare const Zotero: {
  Prefs: {
    get(name: string, global?: boolean): unknown;
    set(name: string, value: string | boolean, global?: boolean): unknown;
  };
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
  Items: {
    get(id: number): unknown;
  };
  Reader?: {
    registerEventListener(type: string, handler: (event: unknown) => void, pluginID: string): void;
    unregisterEventListener(type: string, handler: (event: unknown) => void): void;
  };
  getMainWindows?: () => ZoteroMainWindow[];
  Utilities?: {
    Internal?: {
      getDataDirectory?: () => { path: string };
    };
  };
  ProgressWindow?: new (options?: { window?: Window }) => {
    changeHeadline(text: string): void;
    addDescription(text: string): void;
    show(): void;
    close(): void;
  };
};

declare const Services: {
  prompt?: {
    prompt(
      parent: Window,
      dialogTitle: string,
      text: string,
      value: { value: string },
      checkMsg: string | null,
      checkState: { value: boolean },
    ): boolean;
  };
};

declare const IOUtils: {
  exists(path: string): Promise<boolean>;
  makeDirectory(path: string, options?: { ignoreExisting?: boolean; createAncestors?: boolean }): Promise<void>;
  writeUTF8(path: string, value: string): Promise<void>;
  readUTF8(path: string): Promise<string>;
  write(path: string, value: Uint8Array): Promise<void>;
  read(path: string): Promise<Uint8Array | ArrayBuffer>;
};

type ZoteroMainWindow = Window & {
  Blob?: typeof Blob;
  FormData?: typeof FormData;
  ZoteroPane?: {
    getSelectedItems(): unknown[];
  };
};
