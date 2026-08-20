import type { MineruExtractedFile, MineruParseResult } from "./types/mineru";

export type ObsidianExportFs = {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  writeText(path: string, value: string): Promise<void>;
};

export type ObsidianExportRequest = {
  notesRoot: string;
  folderTitle: string;
  sourcePdfPath: string;
  mineru: MineruParseResult;
};

export type ObsidianExportResult = {
  paperDir: string;
  pdfPath: string;
  sourceMarkdownPath: string;
};

export type ObsidianExporter = {
  exportPaper(request: ObsidianExportRequest): Promise<ObsidianExportResult>;
};

function separatorFor(root: string): "/" | "\\" {
  return root.includes("\\") ? "\\" : "/";
}

function joinPath(...parts: string[]): string {
  const separator = separatorFor(parts[0] ?? "");
  return parts
    .flatMap((part) => part.split(/[\\/]+/))
    .filter(Boolean)
    .join(separator);
}

function safeAssetPath(value: string): string {
  return value
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function isExternalLink(target: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target);
}

export function rewriteMarkdownAssetLinks(markdown: string): string {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (match, prefix, target, suffix) => {
    const trimmed = String(target).trim();
    if (!trimmed || trimmed.startsWith("assets/") || isExternalLink(trimmed)) return match;
    return `${prefix}assets/${safeAssetPath(trimmed)}${suffix}`;
  });
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildHashedPdfName(bytes: Uint8Array, cryptoImpl: Crypto = globalThis.crypto): Promise<string> {
  if (!cryptoImpl?.subtle) {
    throw new Error("No Web Crypto implementation is available for PDF hashing");
  }
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await cryptoImpl.subtle.digest("SHA-256", buffer);
  return `paper-${bytesToHex(digest).slice(0, 16)}.pdf`;
}

async function uniquePaperDir(root: string, folderTitle: string, fs: ObsidianExportFs): Promise<string> {
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = joinPath(root, `${folderTitle}${suffix}`);
    if (!(await fs.exists(candidate))) {
      await fs.mkdir(candidate);
      return candidate;
    }
  }
  throw new Error("Unable to create a unique Obsidian paper directory");
}

async function writeMineruAssets(dir: string, files: MineruExtractedFile[], fs: ObsidianExportFs): Promise<void> {
  if (files.length === 0) return;
  await fs.mkdir(joinPath(dir, "assets"));
  for (const file of files) {
    const assetPath = joinPath(dir, "assets", safeAssetPath(file.path));
    const parent = assetPath.slice(0, Math.max(assetPath.lastIndexOf("/"), assetPath.lastIndexOf("\\")));
    if (parent) await fs.mkdir(parent);
    await fs.writeBytes(assetPath, file.bytes);
  }
}

export function createObsidianExporter(options: { fs: ObsidianExportFs; crypto?: Crypto }): ObsidianExporter {
  return {
    async exportPaper(request) {
      const paperDir = await uniquePaperDir(request.notesRoot, request.folderTitle, options.fs);
      const pdfBytes = await options.fs.readBytes(request.sourcePdfPath);
      const pdfPath = joinPath(paperDir, await buildHashedPdfName(pdfBytes, options.crypto));
      const sourceMarkdownPath = joinPath(paperDir, "原文解析.md");

      await options.fs.writeBytes(pdfPath, pdfBytes);
      await writeMineruAssets(paperDir, request.mineru.files, options.fs);
      await options.fs.writeText(sourceMarkdownPath, rewriteMarkdownAssetLinks(request.mineru.markdown));

      return {
        paperDir,
        pdfPath,
        sourceMarkdownPath,
      };
    },
  };
}

export function createZoteroObsidianFs(ioUtils: {
  exists(path: string): Promise<boolean>;
  makeDirectory(path: string, options?: { ignoreExisting?: boolean; createAncestors?: boolean }): Promise<void>;
  read(path: string): Promise<Uint8Array | ArrayBuffer>;
  write(path: string, value: Uint8Array): Promise<void>;
  writeUTF8(path: string, value: string): Promise<void>;
}): ObsidianExportFs {
  return {
    exists: (path) => ioUtils.exists(path),
    mkdir: (path) => ioUtils.makeDirectory(path, { ignoreExisting: true, createAncestors: true }),
    async readBytes(path) {
      const data = await ioUtils.read(path);
      return data instanceof Uint8Array ? data : new Uint8Array(data);
    },
    writeBytes: (path, value) => ioUtils.write(path, value),
    writeText: (path, value) => ioUtils.writeUTF8(path, value),
  };
}
