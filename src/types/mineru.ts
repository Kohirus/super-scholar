export type MineruMode = "cloud" | "local";

export type MineruLocalBackend = "pipeline" | "vlm" | "hybrid";

export type MineruCloudModel = "auto" | "ocr" | "txt";

export type MineruSettings = {
  mode: MineruMode;
  localApiBase: string;
  localBackend: MineruLocalBackend;
  cloudApiBase: string;
  cloudApiKey: string;
  cloudModel: MineruCloudModel;
  forceOcr: boolean;
};

export type MineruExtractedFile = {
  path: string;
  bytes: Uint8Array;
};

export type MineruParseResult = {
  markdown: string;
  contentList: string | null;
  files: MineruExtractedFile[];
};

export type QueuePdfAttachment = {
  id: number;
  key: string;
  title: string;
  path: string;
};

export type QueueSummary = {
  processed: number;
  skipped: number;
  failed: number;
};
