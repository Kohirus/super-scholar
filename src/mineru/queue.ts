import type {
  MineruParseResult,
  QueuePdfAttachment,
  QueueSummary,
} from "../types/mineru";

export type MineruParseQueueState = {
  running: boolean;
  currentKey: string | null;
  lastError: string | null;
};

export type MineruQueueCache = {
  has(attachment: QueuePdfAttachment): Promise<boolean>;
  write(attachment: QueuePdfAttachment, result: MineruParseResult): Promise<void>;
};

export type MineruParseQueueOptions = {
  parser(attachment: QueuePdfAttachment, signal?: AbortSignal): Promise<MineruParseResult>;
  cache: MineruQueueCache;
};

export class MineruParseQueue {
  private running = false;
  private currentKey: string | null = null;
  private lastError: string | null = null;

  constructor(private readonly options: MineruParseQueueOptions) {}

  getState(): MineruParseQueueState {
    return {
      running: this.running,
      currentKey: this.currentKey,
      lastError: this.lastError,
    };
  }

  async enqueue(
    attachments: QueuePdfAttachment[],
    options: { force?: boolean; signal?: AbortSignal } = {},
  ): Promise<QueueSummary> {
    if (this.running) {
      throw new Error("MinerU parse queue is already running");
    }

    this.running = true;
    const summary: QueueSummary = { processed: 0, skipped: 0, failed: 0 };

    try {
      for (const attachment of attachments) {
        if (options.signal?.aborted) break;
        this.currentKey = attachment.key;
        if (!options.force && (await this.options.cache.has(attachment))) {
          summary.skipped += 1;
          continue;
        }
        try {
          const result = await this.options.parser(attachment, options.signal);
          if (options.signal?.aborted) break;
          await this.options.cache.write(attachment, result);
          summary.processed += 1;
        } catch (error) {
          this.lastError = error instanceof Error ? error.message : String(error);
          summary.failed += 1;
        }
      }
    } finally {
      this.currentKey = null;
      this.running = false;
    }

    return summary;
  }
}
