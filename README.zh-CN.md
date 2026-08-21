# super-scholar

<div style="text-align: center;">
  <img src="./assets/logo.svg" alt="super-scholor" width="30%">
</div>

super-scholar 是一个 Zotero 9 插件，用于把 Zotero 中的 PDF 论文导出
到 Obsidian。插件通过 MinerU 解析 PDF，然后写入解析后的 Markdown，并复制一份 hash 重命名后的 PDF。

## 功能

- 在 Zotero 条目右键菜单中新增 `输出到 Obsidian`。
- 支持选中 PDF 附件，或选中普通条目后自动收集其 PDF 附件。
- 导出时由用户输入论文目录名，并在配置的 Obsidian 目录下创建目录。
- 将原 PDF 复制为 `paper-<sha256前缀>.pdf`，避免路径过长。
- 将 MinerU 输出保存为 `原文解析.md`，图片等资源保存到 `assets/`。

## 设置

在 Zotero 设置中的 `super-scholar` 面板配置：

- MinerU 本地/在线模式、API 地址、在线 Key/模型、backend、是否强制 OCR。
- Obsidian 笔记目录。

插件只负责 Zotero 内的导出流程，不会安装 MinerU、启动本地服务或管理 Obsidian。
设置页提供 MinerU 连接测试按钮；MinerU 测试会跟随当前选中的本地/在线标签页。