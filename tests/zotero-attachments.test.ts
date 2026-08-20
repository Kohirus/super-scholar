import { describe, expect, it } from "vitest";
import { collectPdfAttachmentsFromSelection } from "../src/zotero/attachments";

describe("collectPdfAttachmentsFromSelection", () => {
  it("collects PDF attachments from selected parent items and selected attachments", async () => {
    const attachmentItems = new Map<number, any>([
      [
        2,
        {
          id: 2,
          key: "PDF2",
          parentID: 1,
          isAttachment: () => true,
          attachmentContentType: "application/pdf",
          getField: () => "Attachment PDF",
          getFilePathAsync: async () => "a.pdf",
        },
      ],
      [
        3,
        {
          id: 3,
          key: "HTML3",
          isAttachment: () => true,
          attachmentContentType: "text/html",
        },
      ],
    ]);
    const selected = [
      {
        id: 1,
        key: "ITEM1",
        isRegularItem: () => true,
        isAttachment: () => false,
        getField: () => "Parent Paper",
        getAttachments: () => [2, 3],
      },
      attachmentItems.get(2),
    ];

    const result = await collectPdfAttachmentsFromSelection(selected, {
      getItem: (id) => attachmentItems.get(id),
    });

    expect(result).toEqual([
      {
        id: 2,
        key: "PDF2",
        title: "Parent Paper",
        path: "a.pdf",
      },
    ]);
  });
});
