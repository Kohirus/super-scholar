import type { QueuePdfAttachment } from "../types/mineru";

type ZoteroLikeItem = {
  id: number;
  key?: string;
  parentID?: number;
  attachmentContentType?: string;
  isRegularItem?: () => boolean;
  isAttachment?: () => boolean;
  getAttachments?: () => number[];
  getField?: (field: string) => string;
  getFilePathAsync?: () => Promise<string | false | null | undefined>;
};

export type ZoteroItemLookup = {
  getItem(id: number): ZoteroLikeItem | undefined;
};

function isPdfAttachment(item: ZoteroLikeItem | undefined): item is ZoteroLikeItem {
  return Boolean(item?.isAttachment?.() && item.attachmentContentType === "application/pdf");
}

function itemTitle(item: ZoteroLikeItem): string {
  return item.getField?.("title") || item.getField?.("firstCreator") || `Item ${item.id}`;
}

async function toQueueAttachment(
  attachment: ZoteroLikeItem,
  title: string,
): Promise<QueuePdfAttachment | null> {
  const path = await attachment.getFilePathAsync?.();
  if (!path) return null;
  return {
    id: attachment.id,
    key: attachment.key || String(attachment.id),
    title,
    path,
  };
}

export async function collectPdfAttachmentsFromSelection(
  selectedItems: ZoteroLikeItem[],
  lookup: ZoteroItemLookup,
): Promise<QueuePdfAttachment[]> {
  const seen = new Set<number>();
  const attachments: QueuePdfAttachment[] = [];

  for (const item of selectedItems) {
    if (isPdfAttachment(item) && !seen.has(item.id)) {
      seen.add(item.id);
      const queued = await toQueueAttachment(item, itemTitle(item));
      if (queued) attachments.push(queued);
      continue;
    }

    if (!item.isRegularItem?.()) continue;
    const title = itemTitle(item);
    for (const attachmentId of item.getAttachments?.() ?? []) {
      if (seen.has(attachmentId)) continue;
      const attachment = lookup.getItem(attachmentId);
      if (!isPdfAttachment(attachment)) continue;
      seen.add(attachmentId);
      const queued = await toQueueAttachment(attachment, title);
      if (queued) attachments.push(queued);
    }
  }

  return attachments;
}
