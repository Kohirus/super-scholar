import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractReleaseNotes } from "./extract-changelog.mjs";

const root = resolve(import.meta.dirname, "..");

function versionChanged(basePackageJson, currentPackageJson) {
  return basePackageJson?.version !== currentPackageJson?.version;
}

export function checkReleaseDiscipline({
  basePackageJson,
  changelog,
  currentManifest,
  currentPackageJson,
}) {
  if (!currentPackageJson?.version) {
    throw new Error("package.json must define a version.");
  }
  if (currentManifest?.version !== currentPackageJson.version) {
    throw new Error("manifest.json version must match package.json version.");
  }
  if (basePackageJson && !versionChanged(basePackageJson, currentPackageJson)) {
    throw new Error(`package.json version must be updated for release discipline checks. Current version: ${currentPackageJson.version}.`);
  }
  extractReleaseNotes(changelog, currentPackageJson.version);
}

function readBasePackageJson(baseRef) {
  const ref = baseRef ? `origin/${baseRef}:package.json` : "HEAD^:package.json";
  try {
    const output = execFileSync("git", ["show", ref], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output);
  } catch {
    return null;
  }
}

async function main() {
  const currentPackageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const currentManifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  const changelog = await readFile(resolve(root, "CHANGELOG"), "utf8");
  const basePackageJson = readBasePackageJson(process.env.GITHUB_BASE_REF);

  checkReleaseDiscipline({
    basePackageJson,
    changelog,
    currentManifest,
    currentPackageJson,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
