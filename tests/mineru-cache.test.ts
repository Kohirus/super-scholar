import { describe, expect, it, vi } from "vitest";
import { buildMineruCacheManifest, createMineruCache } from "../src/mineru/cache";
import type { QueuePdfAttachment } from "../src/types/mineru";

describe("MinerU cache", () => {
  it("builds a manifest without storing sensitive settings", () => {
    const manifest = buildMineruCacheManifest(
      { id: 1, key: "ABC", title: "Paper", path: "paper.pdf" },
      "local",
      "pipeline",
    );

    expect(manifest).toMatchObject({
      attachmentKey: "ABC",
      title: "Paper",
      mode: "local",
      backend: "pipeline",
      version: 1,
    });
    expect(JSON.stringify(manifest)).not.toContain("apiKey");
  });

  it("writes Markdown, content list, manifest, and assets under the attachment cache", async () => {
    const writes = new Map<string, string | Uint8Array>();
    const cache = createMineruCache({
      rootDir: "cache-root",
      mode: "local",
      backend: "pipeline",
      fs: {
        exists: vi.fn(async () => false),
        mkdir: vi.fn(async () => undefined),
        writeText: vi.fn(async (path, value) => {
          writes.set(path, value);
        }),
        writeBytes: vi.fn(async (path, value) => {
          writes.set(path, value);
        }),
      },
    });
    const attachment: QueuePdfAttachment = {
      id: 1,
      key: "ABC",
      title: "Paper",
      path: "paper.pdf",
    };

    await cache.write(attachment, {
      markdown: "# Paper",
      contentList: "[]",
      files: [{ path: "images/fig.png", bytes: new Uint8Array([1]) }],
    });

    expect(writes.get("cache-root/ABC/full.md")).toBe("# Paper");
    expect(writes.get("cache-root/ABC/content_list.json")).toBe("[]");
    expect(writes.get("cache-root/ABC/assets/images/fig.png")).toEqual(new Uint8Array([1]));
    expect(writes.has("cache-root/ABC/manifest.json")).toBe(true);
  });
});
