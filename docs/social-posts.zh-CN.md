# 社媒发布素材

## X / 即刻 / Threads 短帖

我做了一个本地版 Codex 扩展中心。

它可以一键扫描你电脑上的 Plugin、Skill、MCP 和 App，告诉你：

- 装了什么；
- 怎么调用；
- 哪些是项目级/全局；
- 哪些重复或元数据异常；
- 第三方插件有没有检查更新；
- 当前任务应该用哪个扩展。

全程本地运行，不执行插件脚本，不上传数据。

一键安装：

```bash
curl -fsSL https://raw.githubusercontent.com/Daviddwt/codex-extension-hub/main/scripts/install.sh | bash
```

GitHub：

```text
https://github.com/Daviddwt/codex-extension-hub
```

## 公众号开头

最近我在整理自己的 Codex 工作流时，发现一个很实际的问题：插件和 skill 越装越多，但真正要用的时候，反而很难判断“我到底装了什么、该调用哪个、哪个是重复的”。

所以我做了一个本地版 **Codex 扩展中心**。它会把你电脑上的 Plugin、Skill、MCP、App/Connector 和 Hook 扫描出来，整理成一个网页工作台：能搜索、能筛选、能看调用方式、能查异常，也能根据你要做的任务推荐合适扩展。

最重要的是，它只读扫描本机元数据，不执行插件脚本，不上传本地数据。

## 论坛帖标题备选

- 我做了一个本地 Codex 扩展中心：管理 Plugin、Skill、MCP 的小工具
- Codex 插件越装越多？用这个本地仪表盘整理一下
- 开源：Codex Extension Hub，本地扫描和推荐你的 Codex 扩展

## 论坛帖摘要

Codex Extension Hub 是一个本地运行的扩展管理网页。它会扫描本机可发现的 Plugin、Skill、MCP Server、App/Connector 和 Hook 元数据，并展示来源、安装范围、调用方式、中文用途说明、启用状态、异常提示和第三方更新记录。推荐框基于本地元数据打分，不调用云端大模型。适合插件多、skill 多、项目级工具多的用户整理自己的 Codex 工作台。
