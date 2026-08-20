import { extractMineruZip } from "./zip";
import { normalizeMineruLocalApiBase } from "../settings";
import type { MineruParseResult, MineruSettings } from "../types/mineru";

export class MineruClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "auth"
      | "cancelled"
      | "network"
      | "rate-limit"
      | "service-unavailable"
      | "missing-result",
  ) {
    super(message);
    this.name = "MineruClientError";
  }
}

export type MineruProgressCallback = (stage: string) => void;

export type MineruClientRuntime = {
  fetch?: typeof fetch;
  FormData?: typeof FormData;
  Blob?: typeof Blob;
  readFile?: (path: string) => Promise<Uint8Array>;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

function getFetch(runtime?: MineruClientRuntime): typeof fetch {
  const fetchImpl = runtime?.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new MineruClientError("No fetch implementation is available", "network");
  }
  return fetchImpl;
}

function getFormData(runtime?: MineruClientRuntime): typeof FormData {
  const formDataImpl = runtime?.FormData ?? globalThis.FormData;
  if (!formDataImpl) {
    throw new MineruClientError("No FormData implementation is available", "network");
  }
  return formDataImpl;
}

function getBlob(runtime?: MineruClientRuntime): typeof Blob {
  const blobImpl = runtime?.Blob ?? globalThis.Blob;
  if (!blobImpl) {
    throw new MineruClientError("No Blob implementation is available", "network");
  }
  return blobImpl;
}

async function readPdfBytes(path: string, runtime?: MineruClientRuntime): Promise<Uint8Array> {
  if (runtime?.readFile) return runtime.readFile(path);

  const io = (globalThis as { IOUtils?: { read(path: string): Promise<Uint8Array | ArrayBuffer> } })
    .IOUtils;
  if (io?.read) {
    const data = await io.read(path);
    return data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  throw new MineruClientError("Unable to read the PDF attachment file", "network");
}

function joinApiPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new MineruClientError("MinerU parsing was cancelled", "cancelled");
  }
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new MineruClientError("MinerU parsing was cancelled", "cancelled"));
      },
      { once: true },
    );
  });
}

async function responseBytes(response: Response): Promise<Uint8Array> {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function withSignal(init: RequestInit, signal?: AbortSignal): RequestInit {
  return signal ? { ...init, signal } : init;
}

function normalizeLocalBackendForApi(backend: MineruSettings["localBackend"]): string {
  if (backend === "hybrid") return "hybrid-engine";
  if (backend === "vlm") return "vlm-engine";
  return backend;
}

async function parseLocal(
  pdfPath: string,
  settings: MineruSettings,
  onProgress?: MineruProgressCallback,
  signal?: AbortSignal,
  runtime?: MineruClientRuntime,
): Promise<MineruParseResult> {
  const fetchImpl = getFetch(runtime);
  const FormDataImpl = getFormData(runtime);
  const BlobImpl = getBlob(runtime);
  const base = normalizeMineruLocalApiBase(settings.localApiBase);
  const pdfBytes = await readPdfBytes(pdfPath, runtime);
  const form = new FormDataImpl();
  form.append(
    "files",
    new BlobImpl([toArrayBuffer(pdfBytes)], { type: "application/pdf" }),
    pdfPath.split(/[\\/]/).pop(),
  );
  form.set("backend", normalizeLocalBackendForApi(settings.localBackend));
  form.set("parse_method", settings.forceOcr ? "ocr" : "auto");
  form.set("response_format_zip", "true");
  form.set("return_content_list", "true");
  form.set("return_images", "true");

  onProgress?.("Uploading PDF to local MinerU service");
  throwIfAborted(signal);
  const response = await fetchImpl(
    joinApiPath(base, "/file_parse"),
    withSignal({ method: "POST", body: form }, signal),
  );

  if (!response.ok) {
    const code = response.status === 404 ? "service-unavailable" : "network";
    throw new MineruClientError(`Local MinerU parse failed: HTTP ${response.status}`, code);
  }

  onProgress?.("Extracting local MinerU result");
  return extractMineruZip(await responseBytes(response));
}

function requireCloudKey(settings: MineruSettings): string {
  const apiKey = settings.cloudApiKey.trim();
  if (!apiKey) {
    throw new MineruClientError("MinerU cloud API key is required", "auth");
  }
  return apiKey;
}

async function parseCloud(
  pdfPath: string,
  settings: MineruSettings,
  onProgress?: MineruProgressCallback,
  signal?: AbortSignal,
  runtime?: MineruClientRuntime,
): Promise<MineruParseResult> {
  const fetchImpl = getFetch(runtime);
  const sleep = runtime?.sleep ?? defaultSleep;
  const apiBase = settings.cloudApiBase.replace(/\/+$/, "");
  const apiKey = requireCloudKey(settings);
  const pdfBytes = await readPdfBytes(pdfPath, runtime);
  const headers = { Authorization: `Bearer ${apiKey}` };

  onProgress?.("Requesting MinerU cloud upload URL");
  const createResponse = await fetchImpl(
    joinApiPath(apiBase, "/file-urls/batch"),
    withSignal(
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              name: pdfPath.split(/[\\/]/).pop() || "paper.pdf",
              model_version: settings.cloudModel,
              is_ocr: settings.forceOcr,
            },
          ],
        }),
      },
      signal,
    ),
  );

  if (createResponse.status === 401 || createResponse.status === 403) {
    throw new MineruClientError("MinerU cloud authentication failed", "auth");
  }
  if (createResponse.status === 429) {
    throw new MineruClientError("MinerU cloud rate limit reached", "rate-limit");
  }
  if (!createResponse.ok) {
    throw new MineruClientError(`MinerU cloud upload URL request failed: HTTP ${createResponse.status}`, "network");
  }

  const createData = (await createResponse.json()) as {
    data?: { batch_id?: string; file_urls?: string[] };
  };
  const batchId = createData.data?.batch_id;
  const uploadUrl = createData.data?.file_urls?.[0];
  if (!batchId || !uploadUrl) {
    throw new MineruClientError("MinerU cloud did not return an upload URL", "missing-result");
  }

  onProgress?.("Uploading PDF to MinerU cloud");
  const uploadResponse = await fetchImpl(
    uploadUrl,
    withSignal({ method: "PUT", body: toArrayBuffer(pdfBytes) }, signal),
  );
  if (!uploadResponse.ok) {
    throw new MineruClientError(`MinerU cloud upload failed: HTTP ${uploadResponse.status}`, "network");
  }

  for (let attempt = 0; attempt < 240; attempt += 1) {
    throwIfAborted(signal);
    await sleep(attempt === 0 ? 0 : 3000, signal);
    onProgress?.("Waiting for MinerU cloud parsing result");
    const pollResponse = await fetchImpl(
      joinApiPath(apiBase, `/extract-results/batch/${batchId}`),
      withSignal({ method: "GET", headers }, signal),
    );

    if (pollResponse.status === 429) {
      throw new MineruClientError("MinerU cloud rate limit reached", "rate-limit");
    }
    if (!pollResponse.ok) continue;

    const pollData = (await pollResponse.json()) as {
      data?: { extract_result?: Array<{ state?: string; full_zip_url?: string }> };
    };
    const result = pollData.data?.extract_result?.[0];
    const state = result?.state?.toLowerCase();
    if (state === "failed") {
      throw new MineruClientError("MinerU cloud parsing failed", "missing-result");
    }
    if (state === "done") {
      if (!result?.full_zip_url) {
        throw new MineruClientError("MinerU cloud result is missing a ZIP URL", "missing-result");
      }
      onProgress?.("Downloading MinerU cloud result");
      const zipResponse = await fetchImpl(result.full_zip_url, withSignal({ method: "GET" }, signal));
      if (!zipResponse.ok) {
        throw new MineruClientError(`MinerU cloud ZIP download failed: HTTP ${zipResponse.status}`, "network");
      }
      return extractMineruZip(await responseBytes(zipResponse));
    }
  }

  throw new MineruClientError("Timed out waiting for MinerU cloud result", "missing-result");
}

export async function parsePdfWithMineru(
  pdfPath: string,
  settings: MineruSettings,
  onProgress?: MineruProgressCallback,
  signal?: AbortSignal,
  runtime?: MineruClientRuntime,
): Promise<MineruParseResult> {
  if (settings.mode === "cloud") {
    return parseCloud(pdfPath, settings, onProgress, signal, runtime);
  }
  return parseLocal(pdfPath, settings, onProgress, signal, runtime);
}

export async function testMineruConnection(
  settings: MineruSettings,
  runtime?: MineruClientRuntime,
): Promise<void> {
  const fetchImpl = getFetch(runtime);
  if (settings.mode === "cloud") {
    const apiKey = requireCloudKey(settings);
    const response = await fetchImpl(joinApiPath(settings.cloudApiBase.replace(/\/+$/, ""), "/extract-results/batch/_test"), {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401 || response.status === 403) {
      throw new MineruClientError("MinerU cloud authentication failed", "auth");
    }
    return;
  }

  const response = await fetchImpl(joinApiPath(normalizeMineruLocalApiBase(settings.localApiBase), "/health"), {
    method: "GET",
  });
  if (!response.ok) {
    throw new MineruClientError(`Local MinerU health check failed: HTTP ${response.status}`, "service-unavailable");
  }
}
