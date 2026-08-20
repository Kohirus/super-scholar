import { describe, expect, it } from "vitest";
import { sanitizeDirectoryName } from "../src/folderName";

describe("sanitizeDirectoryName", () => {
  it("removes filesystem-invalid characters and limits the folder name length", () => {
    const value = `${"A".repeat(100)}: paper / title?`;

    expect(sanitizeDirectoryName(value)).toHaveLength(80);
    expect(sanitizeDirectoryName("User: Folder?")).toBe("User Folder");
    expect(sanitizeDirectoryName("...")).toBe("Untitled Paper");
  });
});
