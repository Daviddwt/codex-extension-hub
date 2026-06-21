# 把 Codex 插件变成可管理资产：Codex 扩展中心上手教程

如果你已经开始大量使用 Codex 的 Plugin、Skill、MCP 和本地工具，很快会遇到一个现实问题：扩展越来越多，但你很难回答“我到底装了什么、该用哪个、哪个是重复的、哪个需要更新”。

**Codex 扩展中心**就是为这个场景做的本地网页应用。它不会执行任何插件脚本，也不会上传你的本地数据，只把已经存在于本机的扩展元数据整理成一个可搜索、可筛选、可审查的工作台。

## 适合谁

- 已经安装了多个 Codex 插件或 skill 的用户；
- 经常在不同项目里复用 agent 能力的人；
- 想给团队整理一套“可发现、可调用、可维护”的扩展目录；
- 想检查重复安装、元数据缺失、第三方插件更新状态的人。

## 推荐安装方式：把目标说给 agent

不要把教程设计成“复制远程 shell 命令直接执行”。更适合 agent 时代的安装方式，是把目标、仓库地址和安全边界讲清楚，让本地 agent 自己读取说明、执行安装并完成验证。

你可以这样对 agent 说：

```text
请给我的 Codex 安装以下本地工具：
https://github.com/Daviddwt/codex-extension-hub

请先自行读取 README 和安全注意事项，下载或克隆最新版本，安装依赖，
运行本地扫描，启动网页工作台，打开浏览器并完成页面可用性验证。

不要执行扫描到的 Plugin、Skill、Hook 或 MCP 脚本。
不要上传本机扩展数据。
```

如果你想自己手动操作，可以按这个透明路径执行：

```bash
git clone https://github.com/Daviddwt/codex-extension-hub.git
cd codex-extension-hub
npm install
npm run scan
npm run dev
```

打开浏览器：

```text
http://127.0.0.1:5173
```

## 第一次打开会看到什么

首页是一张本地扩展仪表盘：

- **总扩展**：扫描到的 Plugin、Skill、MCP、App/Connector、Hook 总数；
- **Plugin / Skill / MCP**：按类型统计，点击后下方列表会同步筛选；
- **项目级 / 全局**：看扩展安装在哪个层级；
- **异常**：配置提醒，例如同名扩展存在多个安装位置；
- **最近第三方插件检查**：展示更新检查结果；
- **任务智能推荐**：输入你要做的事，它会基于本地元数据推荐扩展。

这里的“异常”不是插件运行失败，而是配置提醒。比如同一个 skill 同时出现在多个安装目录，扩展中心会提醒你检查调用优先级。

## 用任务找插件

你可以在推荐框里输入：

```text
我要做一个适合发在公众号和 X 的 AI 使用技巧教程，需要封面、有文字、有配图
```

扩展中心会根据已扫描的扩展名称、用途说明、分类、提示词等本地元数据打分，推荐可能适合的插件或 skill。

注意：当前推荐是本地规则推荐，不是外部大模型，不会把你的任务描述上传到云端。

## 检查重复和异常

点击顶部的 **异常** 卡片，下方列表会只显示存在配置提醒的扩展。每张卡片会显示 `配置异常` 标签，点进详情可以看到具体 warning。

常见 warning：

- 同名扩展存在多个安装位置；
- 缺少 `SKILL.md`；
- 元数据不完整；
- marketplace 记录和本地缓存不一致。

这一步非常适合定期整理本机扩展环境。

## 第三方插件更新

手动检查：

```bash
npm run update:third-party
```

只做策略演练、不实际更新：

```bash
npm run update:third-party -- --dry-run
```

它只会处理符合策略的第三方 marketplace 插件。自建插件、local-plugins、系统运行时托管插件会跳过，避免误改你的本地开发版本。

你也可以用 cron 每周日凌晨 3 点执行：

```cron
0 3 * * 0 cd "$HOME/codex-extension-hub" && npm run update:third-party >> "$HOME/codex-extension-hub/update.log" 2>&1
```

## 安全边界

Codex 扩展中心只读扫描元数据：

- 不执行 Plugin、Skill、Hook 或 MCP 脚本；
- 不启动 MCP Server；
- 不上传本地扩展数据；
- 默认忽略 `data/*.json`，避免把本机路径和扩展名称提交到 GitHub；
- 敏感字段会脱敏，例如 token、secret、password、api_key、authorization、cookie、headers、env。

## 推荐工作流

1. 用自然语言让 agent 安装并验证扩展中心。
2. 点击统计卡片，了解本机扩展结构。
3. 搜索常用任务，确认应该调用哪个扩展。
4. 点“异常”清理重复安装或元数据缺失。
5. 每周检查第三方插件更新。
6. 把团队常用扩展沉淀成统一的 skill/plugin 命名规范。

## 适合发布的一句话

我做了一个本地版 Codex 扩展中心：一键扫描你电脑上的 Plugin、Skill、MCP 和 App，告诉你装了什么、怎么调用、哪个重复、哪个该更新，还能按任务推荐应该用哪个扩展。全程本地运行，不执行插件脚本，不上传数据。

项目地址：

```text
https://github.com/Daviddwt/codex-extension-hub
```
