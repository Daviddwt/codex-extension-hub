# Codex Extension Hub

**Codex Extension Hub** is a local web app for discovering, auditing, and reusing Codex extensions on your own machine.

It scans local metadata for Plugins, Skills, MCP servers, Apps/Connectors, and Hooks, then turns that scattered information into a searchable interface with install scope, invocation names, source paths, warnings, update records, and local task-based recommendations.

## Language

| English | 中文 |
| --- | --- |
| **README** | [中文说明](./README.zh-CN.md) |
| [English tutorial](./docs/tutorial.en.md) | [中文教程](./docs/tutorial.zh-CN.md) |
| [English sharing copy](./docs/social-posts.en.md) | [中文发布文案](./docs/social-posts.zh-CN.md) |

## Why This Exists

Codex extensions quickly become hard to manage once you install curated plugins, local skills, marketplace bundles, and project-level tools. This project gives you one local control surface:

- See what is installed and where it came from.
- Search by name, purpose, prompt, project, path, or marketplace.
- Ask the local recommender which extension fits a task.
- Find duplicate or incomplete metadata before it causes confusion.
- Track third-party plugin update checks without touching self-built plugins.

## What The Software Does

- **Local extension catalog**: reads discoverable Plugin, Skill, MCP, App/Connector, and Hook metadata from local Codex/agent folders.
- **Search and filters**: lets you browse by type, category, install scope, project, marketplace source, status, and favorites.
- **Task-based recommendations**: accepts a plain-language task and suggests likely extensions from local metadata.
- **Abnormal item review**: highlights duplicate names, missing skill files, and incomplete plugin/marketplace metadata.
- **Third-party update records**: checks eligible third-party marketplace plugins while skipping self-built/local extensions.
- **Self-built extension discovery**: after a scan, locally created plugins or skills can appear in the hub with their metadata and invocation names.
- **Safety-first local dashboard**: shows paths, invocation names, usage prompts, and warnings without executing extension scripts.

## Agent Install Prompt

For agent-first workflows, do not paste remote one-line installers. Ask your local agent to read the repository, install it, and verify the result.

```text
Install this local Codex tool for me:
https://github.com/Daviddwt/codex-extension-hub

Please read the README and safety notes first, clone or download the latest version,
install dependencies, run the local scan, start the web dashboard, open it in the
browser, and verify that the page loads.

Do not execute any discovered Plugin, Skill, Hook, or MCP scripts. Do not upload
local extension data.
```

Transparent manual path, if you prefer to run each step yourself:

```bash
git clone https://github.com/Daviddwt/codex-extension-hub.git
cd codex-extension-hub
npm install
npm run scan
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Requirements

- macOS, Linux, or WSL
- Node.js 20+
- npm
- Optional: Codex/Agent extension folders on your machine
- Optional: `codex` CLI if you want third-party plugin update checks

## Common Commands

```bash
npm run scan                # Read local metadata and write data/extensions.json
npm run dev                 # Start the local web app and API
npm run test                # Run scanner and safety tests
npm run build               # Build the frontend
npm run update:third-party  # Check/update eligible third-party marketplace plugins
```

Dry-run third-party update policy:

```bash
npm run update:third-party -- --dry-run
```

## Configuration

Edit `catalog.config.json`:

```json
{
  "projectRoots": [],
  "maxDepth": 4,
  "includeAdminSkills": true,
  "includePluginCache": true
}
```

Notes:

- `projectRoots`: optional project roots to scan for `.agents/skills`, `.codex/config.toml`, and marketplace metadata. The current app directory is always included.
- `maxDepth`: how deep the project discovery helper should look inside common project folders.
- `includeAdminSkills`: include `/etc/codex/skills` when available.
- `includePluginCache`: include `~/.codex/plugins/cache`.

The app does not recursively scan your whole home directory.

## Safety Boundaries

This project is intentionally local-first and conservative:

- It does **not** execute Plugin, Skill, Hook, or MCP scripts.
- It does **not** start MCP servers.
- It does **not** upload extension data.
- The recommendation box is a local metadata scorer, not an external LLM.
- Environment values are redacted; environment variable names may be shown.
- Sensitive fields such as `token`, `secret`, `password`, `api_key`, `authorization`, `cookie`, `bearer`, `headers`, `env`, and similar keys are redacted.
- Generated scan output in `data/*.json` is ignored by git because it may contain local paths and extension names.

## What Counts as an “Abnormal” Extension?

The dashboard counts an extension as abnormal when its status is not `正常` or `禁用`. Common causes include:

- duplicate extension names in multiple install locations;
- missing `SKILL.md` or metadata files;
- incomplete marketplace/plugin metadata.

This is a configuration warning, not proof that the extension cannot run.

## Weekly Third-Party Updates

The update command only targets non-self-built, non-managed marketplace plugins. It skips local/self-built plugins and managed runtime bundles.

To schedule it yourself, use cron or launchd. Example cron entry:

```cron
0 3 * * 0 cd "$HOME/codex-extension-hub" && npm run update:third-party >> "$HOME/codex-extension-hub/update.log" 2>&1
```

The UI shows the latest update summary and per-extension update records after the command writes `data/plugin-updates.json`.

## GitHub Hygiene

The public repo intentionally ignores:

- `data/*.json`
- `node_modules/`
- `dist/`
- local screenshots and Playwright traces
- private workspace notes and generated experiments

Run this before publishing changes:

```bash
npm run test
npm run build
```

## License

MIT
