import { describe, expect, it, vi } from "vitest";
import { createZoteroExportProgressReporter } from "../src/ui/exportProgress";

describe("Zotero export progress reporter", () => {
  it("updates one ProgressWindow item with percent and stage text", () => {
    const initiatingWindow = {} as Window;
    const constructorOptions: unknown[] = [];
    const setProgress = vi.fn();
    const setText = vi.fn();
    const show = vi.fn();
    const close = vi.fn();
    const changeHeadline = vi.fn();
    const timer = vi.fn((callback: () => void, _ms: number) => {
      callback();
      return 1 as unknown as NodeJS.Timeout;
    });
    class ProgressWindow {
      constructor(options?: unknown) {
        constructorOptions.push(options);
      }

      changeHeadline = changeHeadline;
      show = show;
      close = close;
      ItemProgress = vi.fn().mockImplementation(() => ({ setProgress, setText }));
    }

    const reporter = createZoteroExportProgressReporter({
      progressWindow: ProgressWindow,
      closeDelayMs: 10,
      setTimeout: timer,
      icon: "content/icons/logo.svg",
      window: initiatingWindow,
      locale: "en-US",
    });

    reporter?.start({ total: 2 });
    reporter?.update({
      attachmentTitle: "Paper",
      stage: "mineru.local.uploading",
      completed: 0,
      total: 2,
      percent: 18,
    });
    reporter?.finish({ processed: 1, skipped: 1, failed: 0 });
    reporter?.close();

    expect(changeHeadline).toHaveBeenCalledWith("super-scholar");
    expect(constructorOptions).toEqual([{ window: initiatingWindow }]);
    expect(show).toHaveBeenCalledOnce();
    expect(setText).toHaveBeenCalledWith("Uploading PDF to local MinerU service: Paper");
    expect(setProgress).toHaveBeenCalledWith(18);
    expect(setProgress).toHaveBeenCalledWith(100);
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 10);
    expect(close).toHaveBeenCalledOnce();
  });

  it("renders semantic progress and summaries in Simplified Chinese", () => {
    const setProgress = vi.fn();
    const setText = vi.fn();
    class ProgressWindow {
      changeHeadline = vi.fn();
      show = vi.fn();
      close = vi.fn();
      ItemProgress = vi.fn().mockImplementation(() => ({ setProgress, setText }));
    }
    const reporter = createZoteroExportProgressReporter({
      progressWindow: ProgressWindow,
      locale: "zh-CN",
      setTimeout: () => 1,
    });

    reporter?.start({ total: 3 });
    reporter?.update({
      attachmentTitle: "论文",
      stage: "mineru.cloud.status",
      variables: { status: "running" },
      completed: 1,
      total: 3,
      percent: 53,
    });
    reporter?.finish({ processed: 2, skipped: 1, failed: 0 });

    expect(setText.mock.calls).toEqual([
      ["正在准备 3 个 PDF"],
      ["MinerU 云端状态：running：论文"],
      ["已完成：导出 2 个，跳过 1 个，失败 0 个"],
    ]);
    expect(setProgress.mock.calls).toEqual([[0], [53], [100]]);
  });
});
