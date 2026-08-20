import { describe, expect, it, vi } from "vitest";
import { createZoteroExportProgressReporter } from "../src/ui/exportProgress";

describe("Zotero export progress reporter", () => {
  it("updates one ProgressWindow item with percent and stage text", () => {
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
    });

    reporter?.start({ total: 2 });
    reporter?.update({
      attachmentTitle: "Paper",
      stage: "Uploading PDF to local MinerU service",
      completed: 0,
      total: 2,
      percent: 18,
    });
    reporter?.finish({ processed: 1, skipped: 1, failed: 0 });
    reporter?.close();

    expect(changeHeadline).toHaveBeenCalledWith("super-scholar");
    expect(show).toHaveBeenCalledOnce();
    expect(setText).toHaveBeenCalledWith("Uploading PDF to local MinerU service: Paper");
    expect(setProgress).toHaveBeenCalledWith(18);
    expect(setProgress).toHaveBeenCalledWith(100);
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 10);
    expect(close).toHaveBeenCalledOnce();
  });
});
