import { zipSync } from "fflate";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const addonDir = resolve(root, "dist", "addon");
const packageDir = resolve(root, "dist", "package");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const MANIFEST_FIRST_FILES = ["manifest.json", "bootstrap.js", "prefs.js", "LICENSE"];

await import(pathToFileURL(resolve(root, "scripts", "build.mjs")));
await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

async function collectFiles(dir, out = {}) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, out);
    } else {
      out[relative(addonDir, path).replace(/\\/g, "/")] = new Uint8Array(await readFile(path));
    }
  }
  return out;
}

const collectedFiles = await collectFiles(addonDir);
const files = {};
for (const name of MANIFEST_FIRST_FILES) {
  if (collectedFiles[name]) {
    files[name] = collectedFiles[name];
    delete collectedFiles[name];
  }
}
for (const name of Object.keys(collectedFiles).sort()) {
  files[name] = collectedFiles[name];
}

const zip = zipSync(files, { level: 0 });
await writeFile(join(packageDir, `${packageJson.name}-${packageJson.version}.xpi`), zip);
