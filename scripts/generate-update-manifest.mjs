import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

export function createUpdateManifest({
  addonID,
  assetName,
  repository,
  sha256,
  strictMaxVersion,
  strictMinVersion,
  version,
}) {
  return {
    addons: {
      [addonID]: {
        updates: [
          {
            version,
            update_link: `https://github.com/${repository}/releases/download/v${version}/${assetName}`,
            update_hash: `sha256:${sha256}`,
            applications: {
              zotero: {
                strict_min_version: strictMinVersion,
                strict_max_version: strictMaxVersion,
              },
            },
          },
        ],
      },
    },
  };
}

export function releaseRepository(env = process.env) {
  const repository = env.ZCO_GITHUB_REPOSITORY ?? env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("Set GITHUB_REPOSITORY or ZCO_GITHUB_REPOSITORY, for example Kohirus/super-scholar.");
  }
  return repository;
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  const addonID = manifest.applications?.zotero?.id;
  const zotero = manifest.applications?.zotero;
  const assetName = `${packageJson.name}-${packageJson.version}.xpi`;
  const packageDir = resolve(root, "dist", "package");
  const xpi = await readFile(join(packageDir, assetName));
  const sha256 = createHash("sha256").update(xpi).digest("hex");
  const updates = createUpdateManifest({
    addonID,
    assetName,
    repository: releaseRepository(),
    sha256,
    strictMaxVersion: zotero.strict_max_version,
    strictMinVersion: zotero.strict_min_version,
    version: packageJson.version,
  });

  await mkdir(packageDir, { recursive: true });
  await writeFile(join(packageDir, "updates.json"), `${JSON.stringify(updates, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
