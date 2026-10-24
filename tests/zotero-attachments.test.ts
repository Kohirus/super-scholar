import { afterEach, describe, expect, it, vi } from "vitest";
import { collectPdfAttachmentsFromSelection } from "../src/zotero/attachments";

describe("collectPdfAttachmentsFromSelection", () => {
  afterEach(() => vi.unstubAllGlobals());
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
        attachmentTitle: "Attachment PDF",
        path: "a.pdf",
      },
    ]);
  });

  it.each([
    ["en-US", "Item 9"],
    ["zh-CN", "条目 9"],
  ])("localizes untitled attachment fallbacks for %s", async (locale, expectedTitle) => {
    vi.stubGlobal("Zotero", { locale });
    const attachment = {
      id: 9,
      key: "PDF9",
      isAttachment: () => true,
      attachmentContentType: "application/pdf",
      getField: () => "",
      getFilePathAsync: async () => "/tmp/paper.pdf",
    };

    const result = await collectPdfAttachmentsFromSelection([attachment], {
      getItem: () => undefined,
    });

    expect(result[0]).toMatchObject({ title: expectedTitle, attachmentTitle: expectedTitle });
  });
});
