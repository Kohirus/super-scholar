import { strFromU8, unzipSync } from "fflate";
import { UiError } from "../i18n";
import type { MineruExtractedFile, MineruParseResult } from "../types/mineru";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function relativeToRoot(path: string, root: string): string {
  const normalized = normalizePath(path);
  return root && normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
}

export function extractMineruZip(bytes: Uint8Array): MineruParseResult {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries).map(normalizePath);
  const fullMdName = names.find((name) => /(^|\/)full\.md$/i.test(name));

  if (!fullMdName) {
    throw new UiError(
      "error.zipMissingMarkdown",
      undefined,
      "MinerU result ZIP is missing full.md",
    );
  }

  const root = fullMdName.includes("/")
    ? fullMdName.slice(0, fullMdName.lastIndexOf("/") + 1)
    : "";
  const markdownEntry = entries[fullMdName];
  if (!markdownEntry) {
    throw new UiError(
      "error.zipMissingMarkdown",
      undefined,
      "MinerU result ZIP is missing full.md",
    );
  }

  const contentListName = names.find((name) => /(^|\/)content_list\.json$/i.test(name));
  const contentList = contentListName ? strFromU8(entries[contentListName]!) : null;
  const files: MineruExtractedFile[] = [];

  for (const name of names) {
    if (name.endsWith("/")) continue;
    if (name === fullMdName || name === contentListName) continue;
    const entry = entries[name];
    if (!entry) continue;
    files.push({
      path: relativeToRoot(name, root),
      bytes: entry,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    markdown: strFromU8(markdownEntry),
    contentList,
    files,
  };
}
