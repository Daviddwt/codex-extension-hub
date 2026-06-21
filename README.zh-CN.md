# Codex 扩展中心

**Codex 扩展中心** 是一个本地运行的网页应用，用来发现、审查和复用你电脑上的 Codex 扩展。

它会只读扫描本机可发现的 Plugin、Skill、MCP Server、App/Connector 和 Hook 元数据，并展示来源、安装范围、调用方式、中文用途说明、启用状态、异常提示、更新记录和本地任务推荐。

[English README](./README.md) · [中文教程](./docs/tutorial.zh-CN.md) · [English tutorial](./docs/tutorial.en.md)

## 它解决什么问题

当你装了官方插件、本地 skill、marketplace 插件和项目级工具后，很快会遇到这些问题：

- 到底装了哪些扩展？
- 这个 skill 应该怎么调用？
- 为什么同名 skill 出现好几次？
- 某个任务应该用哪个插件？
- 第三方插件有没有检查更新？
- 自建插件是否被扩展中心自动发现？

Codex 扩展中心把这些信息收拢到一个本地页面里。

## 推荐安装方式：告诉 agent 你的目标

今后推荐用自然语言让本地 agent 读取仓库、安装、启动和验证，而不是复制远程 shell 命令直接执行。

```text
请给我的 Codex 安装以下本地工具：
https://github.com/Daviddwt/codex-extension-hub

请先自行读取 README 和安全注意事项，下载或克隆最新版本，安装依赖，
运行本地扫描，启动网页工作台，打开浏览器并完成页面可用性验证。

不要执行扫描到的 Plugin、Skill、Hook 或 MCP 脚本。
不要上传本机扩展数据。
```

透明的手动路径：

```bash
git clone https://github.com/Daviddwt/codex-extension-hub.git
cd codex-extension-hub
npm install
npm run scan
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

## 环境要求

- macOS、Linux 或 WSL
- Node.js 20+
- npm
- 可选：本机已有 Codex/Agent 扩展目录
- 可选：如需检查第三方插件更新，需要可用的 `codex` CLI

## 常用命令

```bash
npm run scan                # 只读扫描本机扩展元数据
npm run dev                 # 启动本地网页和 API
npm run test                # 运行扫描器和安全脱敏测试
npm run build               # 构建前端
npm run update:third-party  # 检查并更新符合策略的第三方 marketplace 插件
```

只验证更新策略、不实际更新：

```bash
npm run update:third-party -- --dry-run
```

## 配置扫描范围

编辑 `catalog.config.json`：

```json
{
  "projectRoots": [],
  "maxDepth": 4,
  "includeAdminSkills": true,
  "includePluginCache": true
}
```

说明：

- `projectRoots`：额外扫描的项目根目录，用于发现 `.agents/skills`、`.codex/config.toml` 和 marketplace 元数据。当前应用目录会自动纳入扫描。
- `maxDepth`：在常见项目目录中发现 git 项目的最大深度。
- `includeAdminSkills`：是否读取 `/etc/codex/skills`。
- `includePluginCache`：是否读取 `~/.codex/plugins/cache`。

本工具不会默认递归扫描整个用户主目录。

## 真实能力边界

这个项目刻意保持本地优先和保守边界：

- 不执行 Plugin、Skill、Hook 或 MCP 脚本。
- 不启动 MCP Server。
- 不上传本机扩展数据。
- 推荐框是本地元数据打分，不是外部大模型。
- 环境变量值会脱敏；页面可能展示变量名。
- `token`、`secret`、`password`、`api_key`、`authorization`、`cookie`、`bearer`、`headers`、`env` 等敏感字段会被脱敏。
- `data/*.json` 默认不提交到 git，因为里面可能包含本机路径和扩展名称。

## “异常”是什么意思

仪表盘里的“异常”不是“插件运行失败”。它表示扫描到配置提醒，常见原因包括：

- 同名扩展存在多个安装位置；
- 缺少 `SKILL.md` 或元数据文件；
- marketplace/plugin 元数据不完整。

这些提醒是为了帮你清理扩展目录和调用优先级。

## 每周第三方插件更新

更新命令只处理非自建、非托管运行时的第三方 marketplace 插件。`local-plugins` 自建插件、官方托管 runtime 和系统插件会跳过。

cron 示例：

```cron
0 3 * * 0 cd "$HOME/codex-extension-hub" && npm run update:third-party >> "$HOME/codex-extension-hub/update.log" 2>&1
```

更新结果写入 `data/plugin-updates.json` 后，页面顶部和扩展详情里会显示最近一次检查记录。

## 发布卫生

公开仓库默认忽略：

- `data/*.json`
- `node_modules/`
- `dist/`
- 本地截图和 Playwright trace
- 私有工作区笔记和生成实验目录

提交前建议运行：

```bash
npm run test
npm run build
```

## 许可证

MIT
