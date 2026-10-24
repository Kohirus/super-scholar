import { describe, expect, it } from "vitest";

import { localizeError, resolveUiLocale, translate, UiError } from "../src/i18n";

describe("runtime localization", () => {
  it.each(["zh", "zh-CN", "zh-cn", "zh-Hans", "zh-SG"])(
    "maps %s to Simplified Chinese",
    (locale) => {
      expect(resolveUiLocale(locale)).toBe("zh-CN");
    },
  );

  it.each(["zh-TW", "zh-Hant", "en-US", "fr", ""])(
    "falls back to English for %s",
    (locale) => {
      expect(resolveUiLocale(locale)).toBe("en-US");
    },
  );

  it("accepts Gecko-style locale arrays and uses the first requested locale", () => {
    expect(resolveUiLocale(["zh-Hans-CN", "en-US"])).toBe("zh-CN");
    expect(resolveUiLocale(["zh-TW", "zh-CN"])).toBe("en-US");
  });

  it("falls back to English when a locale source is missing or throws", () => {
    expect(resolveUiLocale(null)).toBe("en-US");
    expect(
      resolveUiLocale(() => {
        throw new Error("locale unavailable");
      }),
    ).toBe("en-US");
  });

  it("renders the selected catalog and defaults to English", () => {
    expect(translate("menu.exportToObsidian", undefined, "en-US")).toBe("Export to Obsidian");
    expect(translate("menu.exportToObsidian", undefined, "zh-CN")).toBe("输出到 Obsidian");
  });

  it("interpolates string and numeric parameters verbatim", () => {
    expect(
      translate(
        "progress.finished",
        { processed: 2, skipped: "$1 {raw} 中文 /tmp/a.pdf", failed: 0 },
        "en-US",
      ),
    ).toBe("Finished: 2 exported, $1 {raw} 中文 /tmp/a.pdf skipped, 0 failed");
  });

  it("localizes stable UI errors and preserves their diagnostic English message", () => {
    const error = new UiError(
      "error.localRequestFailed",
      { status: 503 },
      "Local MinerU parse failed: HTTP 503",
      new Error("network detail"),
    );

    expect(error.message).toBe("Local MinerU parse failed: HTTP 503");
    expect(error.cause).toBeInstanceOf(Error);
    expect(localizeError(error, "en-US")).toBe("Local MinerU request failed (HTTP 503).");
    expect(localizeError(error, "zh-CN")).toBe("本地 MinerU 请求失败（HTTP 503）。");
  });

  it("uses raw diagnostic messages for unknown errors", () => {
    expect(localizeError(new Error("custom backend failure"), "zh-CN")).toBe(
      "custom backend failure",
    );
    expect(localizeError("plain failure", "zh-CN")).toBe("plain failure");
  });
});
