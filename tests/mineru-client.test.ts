import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { parsePdfWithMineru, testMineruConnection } from "../src/mineru/client";
import type { MineruSettings } from "../src/types/mineru";

describe("MinerU client", () => {
  it("checks local service health with /health", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await testMineruConnection(
      {
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline",
        mode: "local",
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "",
        cloudModel: "auto",
        forceOcr: false,
      },
      { fetch: fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8000/health", {
      method: "GET",
    });
  });

  it("parses a PDF through a local /file_parse response ZIP", async () => {
    const zip = zipSync({
      "paper/full.md": strToU8("# Local Paper"),
      "paper/content_list.json": strToU8("[]"),
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
      headers: new Headers({ "content-type": "application/zip" }),
    });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    const result = await parsePdfWithMineru(
      "paper.pdf",
      {
        mode: "local",
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline",
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "",
        cloudModel: "auto",
        forceOcr: false,
      },
      undefined,
      undefined,
      { fetch: fetchImpl, readFile },
    );

    expect(result.markdown).toBe("# Local Paper");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses runtime FormData and Blob constructors when parsing in Zotero windows", async () => {
    const zip = zipSync({
      "paper/full.md": strToU8("# Local Paper"),
      "paper/content_list.json": strToU8("[]"),
    });
    const calls: Array<[string, unknown, string | undefined]> = [];
    class RuntimeFormData {
      append(name: string, value: unknown, filename?: string) {
        calls.push([name, value, filename]);
      }
      set(name: string, value: unknown, filename?: string) {
        calls.push([name, value, filename]);
      }
    }
    class RuntimeBlob {
      constructor(
        public readonly parts: unknown[],
        public readonly options: { type: string },
      ) {}
    }
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
    });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    await parsePdfWithMineru(
      "paper.pdf",
      {
        mode: "local",
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "hybrid",
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "",
        cloudModel: "auto",
        forceOcr: false,
      },
      undefined,
      undefined,
      { fetch: fetchImpl, readFile, FormData: RuntimeFormData, Blob: RuntimeBlob } as any,
    );

    expect(calls[0]?.[0]).toBe("files");
    expect(calls[0]?.[1]).toBeInstanceOf(RuntimeBlob);
    expect(calls[0]?.[2]).toBe("paper.pdf");
    expect(calls).toContainEqual(["backend", "hybrid-engine", undefined]);
    expect(calls).toContainEqual(["response_format_zip", "true", undefined]);
    expect(calls).toContainEqual(["return_content_list", "true", undefined]);
    expect(calls).toContainEqual(["return_images", "true", undefined]);
  });

  it("checks MinerU cloud credentials with the configured API base", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 404 });

    await testMineruConnection(
      {
        mode: "cloud",
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline",
        cloudApiBase: "https://mineru.example/api/v4",
        cloudApiKey: "mineru-key",
        cloudModel: "auto",
        forceOcr: false,
      },
      { fetch: fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://mineru.example/api/v4/extract-results/batch/_test", {
      method: "GET",
      headers: { Authorization: "Bearer mineru-key" },
    });
  });

  it("polls cloud MinerU and downloads the completed ZIP", async () => {
    const zip = zipSync({
      "paper/full.md": strToU8("# Cloud Paper"),
      "paper/content_list.json": strToU8("[]"),
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { batch_id: "batch-1", file_urls: ["https://upload.example/pdf"] },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            extract_result: [{ state: "done", full_zip_url: "https://download.example/result.zip" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
        headers: new Headers({ "content-type": "application/zip" }),
      });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    const result = await parsePdfWithMineru(
      "paper.pdf",
      {
        mode: "cloud",
        localApiBase: "http://127.0.0.1:8000",
        localBackend: "pipeline",
        cloudApiBase: "https://mineru.net/api/v4",
        cloudApiKey: "secret",
        cloudModel: "auto",
        forceOcr: false,
      },
      undefined,
      undefined,
      { fetch: fetchImpl, readFile, sleep: async () => undefined },
    );

    expect(result.markdown).toBe("# Cloud Paper");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });
});
