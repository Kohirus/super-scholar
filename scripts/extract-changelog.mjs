import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

function normalizeVersion(versionOrTag) {
  return String(versionOrTag).trim().replace(/^v/i, "");
}

export function extractReleaseNotes(changelog, versionOrTag) {
  const version = normalizeVersion(versionOrTag);
  const headingPattern = new RegExp(`^##\\s+\\[?v?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?\\s*$`, "im");
  const match = headingPattern.exec(changelog);
  if (!match) {
    throw new Error(`CHANGELOG does not contain a section for version ${version}.`);
  }

  const bodyStart = (match.index ?? 0) + match[0].length;
  const rest = changelog.slice(bodyStart);
  const nextHeading = rest.search(/^##\s+/m);
  const body = (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
  if (!body) {
    throw new Error(`CHANGELOG section for version ${version} is empty.`);
  }
  return body;
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const version = normalizeVersion(process.argv[2] ?? packageJson.version);
  const changelog = await readFile(resolve(root, "CHANGELOG"), "utf8");
  const notes = extractReleaseNotes(changelog, version);
  const outDir = resolve(root, "dist", "package");
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "release-notes.md"), `${notes}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
