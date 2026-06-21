# Codex Extension Hub: A Local Dashboard for Your Codex Plugins and Skills

Once you start collecting Codex plugins, local skills, MCP servers, and project-level tools, a simple question becomes surprisingly hard to answer:

> What do I actually have installed, and which extension should I use for this task?

**Codex Extension Hub** is a local web app that turns scattered extension metadata into a searchable, auditable dashboard. It does not execute extension scripts and does not upload your local data.

## Who It Is For

- Codex users with multiple Plugins, Skills, MCP servers, or Apps/Connectors.
- People who reuse agent capabilities across projects.
- Teams that want a visible extension catalog.
- Users who want to find duplicate installs, incomplete metadata, and third-party update status.

## Recommended Install: Ask Your Agent

For agent-first workflows, avoid copy-pasting one-line shell installers. Give your local agent a clear goal, the repository URL, and the safety boundaries.

Example prompt:

```text
Install this local Codex tool for me:
https://github.com/Daviddwt/codex-extension-hub

Please read the README and safety notes first, clone or download the latest version,
install dependencies, run the local scan, start the web dashboard, open it in the
browser, and verify that the page loads.

Do not execute any discovered Plugin, Skill, Hook, or MCP scripts. Do not upload
local extension data.
```

Transparent manual path:

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

## What You Get

The dashboard shows:

- total extension count;
- Plugins, Skills, MCP servers, Apps/Connectors, and Hooks;
- global vs project-level installation scope;
- abnormal configuration warnings;
- recent third-party plugin update checks;
- a local task-based recommender.

Clicking a metric card filters the extension list below it. For example, clicking **Abnormal** shows only extensions with configuration warnings.

## What “Abnormal” Means

Abnormal does not mean “the extension failed to run.” It means the scanner found a configuration warning, such as:

- duplicate extension names across multiple install locations;
- missing `SKILL.md`;
- incomplete metadata;
- marketplace records that do not match the local cache.

This is meant to help you clean up your extension environment and understand invocation priority.

## Task-Based Recommendations

Type a task like:

```text
I need to create a polished tutorial for X, WeChat, and community forums.
```

The hub scores local metadata such as extension names, descriptions, categories, and prompts, then suggests relevant Plugins or Skills.

Current boundary: this is a local metadata scorer, not an external LLM. Your task text is not uploaded.

## Third-Party Plugin Updates

Check updates manually:

```bash
npm run update:third-party
```

Dry-run the policy:

```bash
npm run update:third-party -- --dry-run
```

The update command skips self-built/local plugins and managed runtime bundles.

Weekly cron example:

```cron
0 3 * * 0 cd "$HOME/codex-extension-hub" && npm run update:third-party >> "$HOME/codex-extension-hub/update.log" 2>&1
```

## Safety Boundaries

Codex Extension Hub is intentionally conservative:

- It does not execute Plugin, Skill, Hook, or MCP scripts.
- It does not start MCP servers.
- It does not upload local extension data.
- `data/*.json` is ignored by git because it may contain local paths and extension names.
- Sensitive fields such as token, secret, password, api_key, authorization, cookie, headers, and env are redacted.

## Suggested Workflow

1. Ask your local agent to install and verify the hub.
2. Use the metric cards to understand your local extension structure.
3. Search for common tasks and copy invocation names.
4. Filter abnormal items and clean up duplicate installs.
5. Check third-party plugin updates weekly.
6. Standardize team extension names and metadata.

Project:

```text
https://github.com/Daviddwt/codex-extension-hub
```
