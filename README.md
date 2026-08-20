# super-scholar

[简体中文](README.zh-CN.md)

<div style="text-align: center;">
  <img src="./assets/logo.svg" alt="super-scholor" width="30%">
</div>

super-scholar is a Zotero 9 add-on that exports Zotero PDF papers into an
Obsidian vault. It uses MinerU to parse PDF content, then writes the parsed
Markdown beside a copied, hash-renamed PDF.


## Features

- Adds an `输出到 Obsidian` item to the Zotero item context menu.
- Collects selected PDF attachments, or PDF attachments under selected regular
  Zotero items.
- Prompts for the paper folder name under the configured Obsidian directory.
- Copies the source PDF as `paper-<sha256-prefix>.pdf`.
- Saves MinerU output as `原文解析.md` with assets under `assets/`.

## Settings

Open the Zotero settings pane for `super-scholar` and configure:

- Local or online MinerU mode, API base URL, credentials/model, backend, and OCR mode.
- Obsidian notes directory.

The add-on only manages the Zotero workflow. It does not install MinerU, start
local services, or manage Obsidian.

The settings pane includes a MinerU connection test button. The test follows the
selected local/online tab.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run package
```

The packaged add-on is written to:

```text
dist/package/super-scholar-0.1.1.xpi
```

For Zotero development loading, create an extension proxy file named:

```text
super-scholar@Kohirus
```

with the path to:

```text
D:\Project\opensource\zotero-codex-obsidian\dist\addon
```
