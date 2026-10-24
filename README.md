# Super-Scholar

[简体中文](README.zh-CN.md)

<div style="text-align: center;">
  <img src="./assets/Super-Scholar-logo.svg" alt="Super-Scholar logo" width="30%">
</div>

Super-Scholar is a Zotero 9 add-on that exports PDF papers from Zotero to
Obsidian. It uses [MinerU](https://mineru.net/) to parse PDF content, writes the
result as Markdown, and copies the source PDF under a hash-based filename.

## 💡 Why this plugin?

Recognizing a PDF with an LLM can consume a large number of tokens, while
extracting images, tables, and formulas is often cumbersome. Super-Scholar was
created to make PDF reading easier and connect Zotero with Obsidian as part of
a personal research workflow.

The workflow is:

1. In Zotero, use Super-Scholar to parse a paper into Markdown and export it to
   a selected folder in Obsidian.
2. Use Codex with a custom skill to read the exported Markdown and generate a
   separate notes file.

## 📖 Features

- Adds an `Export to Obsidian` item to the Zotero item context menu.
- Collects selected PDF attachments, or PDF attachments under selected regular
  Zotero items.
- Excludes unwanted PDF attachments by Zotero attachment title with an optional glob pattern.
- Prompts for the paper folder name under the configured Obsidian directory.
- Copies the source PDF as `paper-<sha256-prefix>.pdf`.
- Saves MinerU output as `原文解析.md` with assets under `assets/`.
- Displays Super-Scholar menus, settings, progress, notifications, and known
  export errors in English or Simplified Chinese according to Zotero's locale.

## ⚙️ Setup

Open the Zotero settings pane for `super-scholar` and configure:

- Local or online MinerU mode, API base URL, credentials/model, backend, and OCR mode.
- Obsidian notes directory.
- Optional PDF attachment-title exclusion glob. Matching is case-sensitive and runs
  against the title shown for the attachment in Zotero; `*` matches any characters.
  Matching attachments are skipped before MinerU conversion. For example, `*-dual`
  excludes an attachment titled `paper-dual`. Leave it blank to process every PDF attachment.

The add-on only manages the Zotero workflow. It does not install MinerU, start
local services, or manage Obsidian.

The settings pane includes a MinerU connection test button. The test follows the
selected local/online tab.

Super-Scholar follows Zotero's application language automatically. Simplified
Chinese locales use Chinese UI text; Traditional Chinese and all other locales
fall back to English. The plugin does not add a separate language selector.

## 🤨 Feedback and suggestions

Bug reports and improvement suggestions are welcome in the issue tracker.
