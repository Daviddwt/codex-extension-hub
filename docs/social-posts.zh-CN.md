# 社媒发布素材

## X / 即刻 / Threads 短帖

我做了一个本地版 Codex 扩展中心。

Codex 插件和 skill 装多了以后，最麻烦的不是安装，而是想不起来：

- 我到底装了什么；
- 这个工具怎么调用；
- 哪些是项目级，哪些是全局；
- 哪些重复了，哪些元数据不完整；
- 第三方插件有没有检查过更新；
- 当前任务该用哪个扩展。

这个工具会读取本机已有的 Plugin、Skill、MCP、App 和 Hook 元数据，整理成一个网页工作台。全程本地运行，不执行插件脚本，不上传数据。

安装方式也尽量简单：把 GitHub 地址和安全要求告诉你的本地 agent，让它自己读取 README、安装依赖、启动页面并完成验证。

```text
请给我的 Codex 安装以下本地工具：
https://github.com/Daviddwt/codex-extension-hub

请自行读取注意事项、下载最新版本、安装依赖、打开网页工作台并完成验证。
不要执行扫描到的 Plugin、Skill、Hook 或 MCP 脚本。
不要上传本机扩展数据。
```

GitHub：

```text
https://github.com/Daviddwt/codex-extension-hub
```

## 公众号开头

最近我在整理自己的 Codex 工作流时，发现一个很实际的问题：插件、skill、MCP 和本地工具越装越多，但真正要用的时候，反而很难判断“我到底装了什么、该调用哪个、哪个是重复的”。

所以我做了一个本地版 **Codex 扩展中心**。

它会把你电脑上已经存在的 Plugin、Skill、MCP、App/Connector 和 Hook 元数据读出来，整理成一个网页工作台。你可以搜索、筛选、看调用方式、看配置提醒，也可以输入一个任务，让它从本机扩展里推荐可能合适的工具。

它不是云端插件市场，也不会执行扫描到的插件脚本。所有数据都留在本机，敏感字段会脱敏，`data/*.json` 这类本地扫描结果也默认不会提交到 GitHub。

## 论坛帖标题备选

- 我做了一个本地 Codex 扩展中心，用来整理 Plugin、Skill 和 MCP
- Codex 插件越装越多？可以先把本机扩展看清楚
- 开源：Codex Extension Hub，本地扫描、搜索和推荐 Codex 扩展

## 论坛帖摘要

Codex Extension Hub 是一个本地运行的扩展管理网页。它读取本机可发现的 Plugin、Skill、MCP Server、App/Connector 和 Hook 元数据，展示来源、安装范围、调用方式、中文用途说明、启用状态、配置提醒和第三方更新记录。你也可以输入任务，让它基于本地元数据推荐可能适合的扩展。它不执行插件脚本，不启动 MCP Server，不上传本机数据。
