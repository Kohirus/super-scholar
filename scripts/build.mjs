import { build } from "esbuild";
import { mkdir, copyFile, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "dist", "addon");

await mkdir(resolve(outDir, "content"), { recursive: true });
await build({
  entryPoints: [resolve(root, "src", "index.ts")],
  outfile: resolve(outDir, "content", "index.js"),
  bundle: true,
  format: "iife",
  globalName: "ZoteroCodexObsidian",
  platform: "browser",
  target: "firefox115",
});

for (const file of ["manifest.json", "bootstrap.js", "prefs.js", "LICENSE"]) {
  await copyFile(resolve(root, file), resolve(outDir, file));
}

await cp(resolve(root, "locale"), resolve(outDir, "locale"), {
  recursive: true,
});

await cp(resolve(root, "content"), resolve(outDir, "content"), {
  recursive: true,
});
await rm(resolve(outDir, "content", "icons"), { recursive: true, force: true });
await mkdir(resolve(outDir, "content", "icons"), { recursive: true });
await copyFile(resolve(root, "assets", "logo.svg"), resolve(outDir, "content", "icons", "logo.svg"));
