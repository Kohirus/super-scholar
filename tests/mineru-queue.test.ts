import { describe, expect, it, vi } from "vitest";
import { MineruParseQueue } from "../src/mineru/queue";
import type { MineruParseResult, QueuePdfAttachment } from "../src/types/mineru";

describe("MineruParseQueue", () => {
  it("processes attachments serially and skips cached items", async () => {
    const calls: string[] = [];
    const parser = vi.fn(async (attachment: QueuePdfAttachment): Promise<MineruParseResult> => {
      calls.push(attachment.key);
      return { markdown: `# ${attachment.key}`, contentList: "[]", files: [] };
    });
    const cache = {
      has: vi.fn(async (attachment: QueuePdfAttachment) => attachment.key === "cached"),
      write: vi.fn(async () => undefined),
    };
    const queue = new MineruParseQueue({ parser, cache });

    const summary = await queue.enqueue([
      { id: 1, key: "cached", title: "Cached", path: "cached.pdf" },
      { id: 2, key: "a", title: "A", path: "a.pdf" },
      { id: 3, key: "b", title: "B", path: "b.pdf" },
    ]);

    expect(calls).toEqual(["a", "b"]);
    expect(summary).toEqual({ processed: 2, skipped: 1, failed: 0 });
    expect(cache.write).toHaveBeenCalledTimes(2);
  });

  it("records failures and continues with the remaining queue", async () => {
    const parser = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ markdown: "# B", contentList: "[]", files: [] });
    const queue = new MineruParseQueue({
      parser,
      cache: {
        has: async () => false,
        write: async () => undefined,
      },
    });

    const summary = await queue.enqueue([
      { id: 1, key: "a", title: "A", path: "a.pdf" },
      { id: 2, key: "b", title: "B", path: "b.pdf" },
    ]);

    expect(summary).toEqual({ processed: 1, skipped: 0, failed: 1 });
    expect(queue.getState().lastError).toBe("network down");
  });
});
