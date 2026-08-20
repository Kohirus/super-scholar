import type {
  MineruMode,
  MineruParseResult,
  QueuePdfAttachment,
} from "../types/mineru";

export type MineruCacheManifest = {
  version: 1;
  attachmentId: number;
  attachmentKey: string;
  title: string;
  mode: MineruMode;
  backend: string;
  generatedAt: string;
};

export type MineruCacheFs = {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  writeText(path: string, value: string): Promise<void>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
};

export type MineruCacheOptions = {
  rootDir: string;
  mode: MineruMode;
  backend: string;
  fs: MineruCacheFs;
};

function joinPath(...parts: string[]): string {
  return parts
    .flatMap((part) => part.split(/[\\/]+/))
    .filter(Boolean)
    .join("/");
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_") || "unknown";
}

function safeAssetPath(value: string): string {
  return value
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .map(safeSegment)
    .join("/");
}

export function buildMineruCacheManifest(
  attachment: QueuePdfAttachment,
  mode: MineruMode,
  backend: string,
): MineruCacheManifest {
  return {
    version: 1,
    attachmentId: attachment.id,
    attachmentKey: attachment.key,
    title: attachment.title,
    mode,
    backend,
    generatedAt: new Date().toISOString(),
  };
}

export function createMineruCache(options: MineruCacheOptions) {
  const attachmentDir = (attachment: QueuePdfAttachment) =>
    joinPath(options.rootDir, safeSegment(attachment.key));

  return {
    async has(attachment: QueuePdfAttachment): Promise<boolean> {
      return options.fs.exists(joinPath(attachmentDir(attachment), "full.md"));
    },

    async write(
      attachment: QueuePdfAttachment,
      result: MineruParseResult,
    ): Promise<void> {
      const dir = attachmentDir(attachment);
      await options.fs.mkdir(dir);
      await options.fs.mkdir(joinPath(dir, "assets"));
      await options.fs.writeText(joinPath(dir, "full.md"), result.markdown);
      if (result.contentList !== null) {
        await options.fs.writeText(joinPath(dir, "content_list.json"), result.contentList);
      }
      await options.fs.writeText(
        joinPath(dir, "manifest.json"),
        `${JSON.stringify(
          buildMineruCacheManifest(attachment, options.mode, options.backend),
          null,
          2,
        )}\n`,
      );

      for (const file of result.files) {
        const assetPath = joinPath(dir, "assets", safeAssetPath(file.path));
        const assetParent = assetPath.slice(0, assetPath.lastIndexOf("/"));
        await options.fs.mkdir(assetParent);
        await options.fs.writeBytes(assetPath, file.bytes);
      }
    },
  };
}

export function createZoteroCacheFs(ioUtils: {
  exists(path: string): Promise<boolean>;
  makeDirectory(path: string, options?: { ignoreExisting?: boolean; createAncestors?: boolean }): Promise<void>;
  writeUTF8(path: string, value: string): Promise<void>;
  write(path: string, value: Uint8Array): Promise<void>;
}): MineruCacheFs {
  return {
    exists: (path) => ioUtils.exists(path),
    mkdir: (path) =>
      ioUtils.makeDirectory(path, {
        ignoreExisting: true,
        createAncestors: true,
      }),
    writeText: (path, value) => ioUtils.writeUTF8(path, value),
    writeBytes: (path, value) => ioUtils.write(path, value),
  };
}
