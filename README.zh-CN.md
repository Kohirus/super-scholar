# super-scholar

<div style="text-align: center;">
  <img src="./assets/Super-Scholar-logo.svg" alt="Super-Scholar logo" width="30%">
</div>

super-scholar 是一个 Zotero 9 插件，用于把 Zotero 中的 PDF 论文导出
到 Obsidian。插件通过 [MinerU](https://mineru.net/) 解析 PDF，然后写入解析后的 Markdown，并复制一份 hash 重命名后的 PDF。

## 💡为什么做这个插件

对于 LLM 大模型而言，去识别一个 PDF 文件会消耗大量 token，此外提取其中的图片、表格、公式等内容比较麻烦，为了更好的阅读 PDF 文献并且将其和 Obsidian 结合以搭建个人的工作流，所以就有了这个插件。

个人的工作流如下：

1. 在 Zotero 中对目标文献使用当前插件将其解析为 markdown 文件并输出到 Obsidian 中的指定文件夹。
2. 使用 Codex 调用自建的 skill 对刚才输出的 markdown 文件进行阅读解析，输出为笔记文件。

## 📖功能说明

- 在 Zotero 条目右键菜单中新增 `输出到 Obsidian`。
- 支持选中 PDF 附件，或选中普通条目后自动收集其 PDF 附件。
- 支持使用可选的附件标题通配模式排除不需要转换的 PDF 附件。
- 导出时由用户输入论文目录名，并在配置的 Obsidian 目录下创建目录。
- 将原 PDF 复制为 `paper-<sha256前缀>.pdf`，避免路径过长。
- 将 MinerU 输出保存为 `原文解析.md`，图片等资源保存到 `assets/`。
- 插件菜单、设置页、进度、通知和已知导出错误会跟随 Zotero 语言显示为英文或简体中文。

## ⚙️如何设置

在 Zotero 设置中的 `super-scholar` 面板配置：

- MinerU 本地/在线模式、API 地址、在线 Key/模型、backend、是否强制 OCR。
- Obsidian 笔记目录。
- 可选的 PDF 附件标题排除通配模式。匹配区分大小写，并针对 Zotero 中显示的
  附件标题执行；`*` 表示任意字符。匹配的附件会在调用 MinerU 前跳过。例如，
  `*-dual` 会排除标题为 `paper-dual` 的附件。留空时处理所有 PDF 附件。

插件只负责 Zotero 内的导出流程，不会安装 MinerU、启动本地服务或管理 Obsidian。
设置页提供 MinerU 连接测试按钮；MinerU 测试会跟随当前选中的本地/在线标签页。

Super-Scholar 会自动跟随 Zotero 的应用语言。简体中文区域设置使用中文界面；
繁体中文及其他语言回退为英文。插件不提供单独的语言选择器。

## 🤨反馈&建议

欢迎在 issue 中提出 bug 或改进建议。
