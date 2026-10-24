export type UiLocale = "en-US" | "zh-CN";

const EN_US_MESSAGES = {
  "menu.exportToObsidian": "Export to Obsidian",
  "prompt.folderName": "Obsidian folder name",
  "setting.obsidianNotesDirectory": "Obsidian notes directory",
  "notification.noPdf": "No PDF attachments found in the current selection.",
  "notification.allFiltered": "All PDF attachments were excluded by the attachment title filter.",
  "notification.missingSettings": "Missing required settings: {settings}.",
  "notification.cancelled": "Export cancelled for {title}.",
  "progress.cancelled": "Export cancelled",
  "progress.writing": "Writing Obsidian files",
  "progress.exported": "Exported",
  "progress.failed": "Export failed",
  "progress.preparing": "Preparing export",
  "progress.preparingOne": "Preparing 1 PDF",
  "progress.preparingMany": "Preparing {total} PDFs",
  "progress.finished": "Finished: {processed} exported, {skipped} skipped, {failed} failed",
  "progress.item": "{stage}: {title}",
  "attachment.untitled": "Item {id}",
  "mineru.readingPdf": "Reading PDF attachment",
  "mineru.local.uploading": "Uploading PDF to local MinerU service",
  "mineru.local.extracting": "Extracting local MinerU result",
  "mineru.cloud.requestingUploadUrl": "Requesting MinerU cloud upload URL",
  "mineru.cloud.receivedUploadUrl": "Received MinerU cloud upload URL",
  "mineru.cloud.uploading": "Uploading PDF to MinerU cloud",
  "mineru.cloud.uploaded": "MinerU cloud upload completed",
  "mineru.cloud.waiting": "Waiting for MinerU cloud parsing result",
  "mineru.cloud.status": "MinerU cloud status: {status}",
  "mineru.cloud.downloading": "Downloading MinerU cloud result",
  "error.fetchUnavailable": "No network request implementation is available.",
  "error.formDataUnavailable": "No form-data implementation is available.",
  "error.blobUnavailable": "No binary-data implementation is available.",
  "error.readPdf": "Unable to read the PDF attachment file.",
  "error.cancelled": "MinerU parsing was cancelled.",
  "error.localRequestFailed": "Local MinerU request failed (HTTP {status}).",
  "error.cloudApiKeyRequired": "MinerU cloud API key is required.",
  "error.cloudAuthentication": "MinerU cloud authentication failed.",
  "error.cloudRateLimit": "MinerU cloud rate limit reached.",
  "error.cloudUploadRequestFailed": "MinerU cloud upload URL request failed (HTTP {status}).",
  "error.cloudUploadUrlMissing": "MinerU cloud did not return an upload URL.",
  "error.cloudUploadFailed": "MinerU cloud upload failed (HTTP {status}).",
  "error.cloudParsingFailed": "MinerU cloud parsing failed.",
  "error.cloudZipUrlMissing": "MinerU cloud result is missing a ZIP URL.",
  "error.cloudDownloadFailed": "MinerU cloud ZIP download failed (HTTP {status}).",
  "error.cloudTimeout": "Timed out waiting for the MinerU cloud result.",
  "error.localHealthFailed": "Local MinerU health check failed (HTTP {status}).",
  "error.zipMissingMarkdown": "MinerU result ZIP is missing full.md.",
  "error.cryptoUnavailable": "PDF hashing is unavailable on this system.",
  "error.uniqueDirectory": "Unable to create a unique Obsidian paper directory.",
  "error.obsidianRootRequired": "Obsidian notes directory is required.",
  "error.obsidianWriteFailed": "Unable to write Obsidian file: {path}.",
} as const;

export type UiMessageKey = keyof typeof EN_US_MESSAGES;

const ZH_CN_MESSAGES = {
  "menu.exportToObsidian": "输出到 Obsidian",
  "prompt.folderName": "Obsidian 文件夹名称",
  "setting.obsidianNotesDirectory": "Obsidian 笔记目录",
  "notification.noPdf": "当前所选条目中没有找到 PDF 附件。",
  "notification.allFiltered": "所有 PDF 附件都已被附件标题过滤规则排除。",
  "notification.missingSettings": "缺少必填设置：{settings}。",
  "notification.cancelled": "已取消导出 {title}。",
  "progress.cancelled": "导出已取消",
  "progress.writing": "正在写入 Obsidian 文件",
  "progress.exported": "已导出",
  "progress.failed": "导出失败",
  "progress.preparing": "正在准备导出",
  "progress.preparingOne": "正在准备 1 个 PDF",
  "progress.preparingMany": "正在准备 {total} 个 PDF",
  "progress.finished": "已完成：导出 {processed} 个，跳过 {skipped} 个，失败 {failed} 个",
  "progress.item": "{stage}：{title}",
  "attachment.untitled": "条目 {id}",
  "mineru.readingPdf": "正在读取 PDF 附件",
  "mineru.local.uploading": "正在上传 PDF 到本地 MinerU 服务",
  "mineru.local.extracting": "正在解压本地 MinerU 结果",
  "mineru.cloud.requestingUploadUrl": "正在请求 MinerU 云端上传地址",
  "mineru.cloud.receivedUploadUrl": "已获取 MinerU 云端上传地址",
  "mineru.cloud.uploading": "正在上传 PDF 到 MinerU 云端",
  "mineru.cloud.uploaded": "PDF 已上传到 MinerU 云端",
  "mineru.cloud.waiting": "正在等待 MinerU 云端解析结果",
  "mineru.cloud.status": "MinerU 云端状态：{status}",
  "mineru.cloud.downloading": "正在下载 MinerU 云端结果",
  "error.fetchUnavailable": "当前环境不支持网络请求。",
  "error.formDataUnavailable": "当前环境不支持表单数据。",
  "error.blobUnavailable": "当前环境不支持二进制数据。",
  "error.readPdf": "无法读取 PDF 附件文件。",
  "error.cancelled": "MinerU 解析已取消。",
  "error.localRequestFailed": "本地 MinerU 请求失败（HTTP {status}）。",
  "error.cloudApiKeyRequired": "需要填写 MinerU 云端 API 密钥。",
  "error.cloudAuthentication": "MinerU 云端身份验证失败。",
  "error.cloudRateLimit": "MinerU 云端请求已达到速率限制。",
  "error.cloudUploadRequestFailed": "请求 MinerU 云端上传地址失败（HTTP {status}）。",
  "error.cloudUploadUrlMissing": "MinerU 云端未返回上传地址。",
  "error.cloudUploadFailed": "上传到 MinerU 云端失败（HTTP {status}）。",
  "error.cloudParsingFailed": "MinerU 云端解析失败。",
  "error.cloudZipUrlMissing": "MinerU 云端结果缺少 ZIP 下载地址。",
  "error.cloudDownloadFailed": "下载 MinerU 云端 ZIP 结果失败（HTTP {status}）。",
  "error.cloudTimeout": "等待 MinerU 云端结果超时。",
  "error.localHealthFailed": "本地 MinerU 健康检查失败（HTTP {status}）。",
  "error.zipMissingMarkdown": "MinerU 结果 ZIP 中缺少 full.md。",
  "error.cryptoUnavailable": "当前系统不支持 PDF 哈希计算。",
  "error.uniqueDirectory": "无法创建唯一的 Obsidian 论文目录。",
  "error.obsidianRootRequired": "需要填写 Obsidian 笔记目录。",
  "error.obsidianWriteFailed": "无法写入 Obsidian 文件：{path}。",
} as const satisfies Record<UiMessageKey, string>;

type MessageVariables = Record<string, string | number>;

function localeValue(source: unknown): unknown {
  if (typeof source === "function") return source();
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  const candidate = source as Record<string, unknown>;
  return (
    candidate.requestedLocales ??
    candidate.appLocalesAsBCP47 ??
    candidate.appLocaleAsBCP47 ??
    candidate.locale
  );
}

function currentLocaleSource(): unknown {
  const globals = globalThis as Record<string, any>;
  return (
    globals.Zotero?.locale ??
    globals.Services?.locale?.requestedLocales ??
    globals.Services?.locale?.appLocalesAsBCP47 ??
    globals.Services?.locale?.appLocaleAsBCP47
  );
}

export function resolveUiLocale(source?: unknown): UiLocale {
  try {
    const value = localeValue(arguments.length === 0 ? currentLocaleSource() : source);
    const locale = (Array.isArray(value) ? value[0] : value);
    if (typeof locale !== "string") return "en-US";
    const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
    if (
      normalized === "zh" ||
      normalized === "zh-cn" ||
      normalized.startsWith("zh-cn-") ||
      normalized === "zh-hans" ||
      normalized.startsWith("zh-hans-") ||
      normalized === "zh-sg" ||
      normalized.startsWith("zh-sg-")
    ) {
      return "zh-CN";
    }
  } catch {
    // A missing or broken application-locale API must not break plugin UI.
  }
  return "en-US";
}

export function translate(
  key: UiMessageKey,
  variables: MessageVariables = {},
  localeOverride?: UiLocale,
): string {
  const locale = localeOverride ?? resolveUiLocale();
  const catalog = locale === "zh-CN" ? ZH_CN_MESSAGES : EN_US_MESSAGES;
  return catalog[key].replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : placeholder,
  );
}

export class UiError extends Error {
  readonly messageKey: UiMessageKey;
  readonly variables: MessageVariables | undefined;
  override readonly cause: unknown;

  constructor(
    messageKey: UiMessageKey,
    variables: MessageVariables | undefined,
    diagnosticMessage: string,
    cause?: unknown,
  ) {
    super(diagnosticMessage);
    this.name = "UiError";
    this.messageKey = messageKey;
    this.variables = variables;
    this.cause = cause;
  }
}

export function localizeError(error: unknown, localeOverride?: UiLocale): string {
  if (error instanceof UiError) {
    return translate(error.messageKey, error.variables, localeOverride);
  }
  return error instanceof Error ? error.message : String(error);
}
