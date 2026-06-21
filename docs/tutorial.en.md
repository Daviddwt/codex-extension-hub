# I Built a Local Extension Hub for Codex

After you use Codex for a while, plugins, skills, MCP servers, and local tools start to pile up. At some point, the hard part is no longer installing one more tool. The hard part is remembering what you already have:

- What is the exact invocation name?
- Did I install multiple versions of the same skill?
- Which extension should I use for this task?
- Is this project-level or global?
- Have third-party plugins been checked for updates?
- Can my own local plugins and skills show up in one place?

That is why I built **Codex Extension Hub**.

It is a local web app for your own Codex extension environment. It reads local extension metadata and turns it into a dashboard you can search, filter, audit, and use for task-based recommendations.

Project:

```text
https://github.com/Daviddwt/codex-extension-hub
```

## What It Does

The hub helps you see:

- discovered Plugins, Skills, MCP servers, Apps/Connectors, and Hooks;
- where each extension is installed: global, project-level, marketplace, or local;
- invocation names, usage notes, paths, status, and prompt hints;
- configuration warnings such as duplicate names, missing skill files, or incomplete marketplace metadata;
- third-party marketplace plugin update records;
- newly created local plugins or skills after you rerun the scanner;
- task-based extension suggestions from local metadata.

The boundary is intentionally conservative: it does not execute extension scripts, does not start MCP servers, and does not upload local extension data. The recommendation box is currently a local metadata scorer, not an external LLM.

## Recommended Install: Tell Your Agent the Goal

For public tutorials, I do not recommend asking people to paste a remote one-line install script. A better agent-first pattern is to tell your local agent the goal, the repository URL, and the safety boundaries, then let the agent read the README, install dependencies, start the dashboard, and verify the page.

Use a prompt like this:

```text
Install this local Codex tool for me:
https://github.com/Daviddwt/codex-extension-hub

Please read the README and safety notes first, clone or download the latest version,
install dependencies, run the local scan, start the web dashboard, open it in the
browser, and verify that the page loads.

Do not execute any discovered Plugin, Skill, Hook, or MCP scripts. Do not upload
local extension data.
```

If you prefer manual commands, the GitHub README keeps a transparent step-by-step path. This tutorial does not rely on a remote one-line installer.

For future plugin tutorials, use the same natural-language pattern:

```text
Install this Codex plugin from the following URL:
https://github.com/Daviddwt/solution-factory

Please read the notes first, download the latest shared package, install the plugin,
open the web workbench, and verify that it works.

Do not execute unknown scripts. If permissions, login state, or local paths are
required, explain that first before continuing.
```

## What You See First

The first screen is a local extension dashboard.

The metric cards show total extensions, Plugins, Skills, MCP servers, project-level items, global items, disabled items, and abnormal items. Clicking a metric card filters the list below.

For example, clicking **Abnormal** shows extensions with configuration warnings. “Abnormal” does not mean the extension failed to run. It means the scanner found something worth reviewing, such as duplicate names, missing `SKILL.md`, incomplete metadata, or a mismatch between marketplace records and the local cache.

The browse area gives you search, filters, card view, table view, project grouping, category grouping, and plugin-source grouping.

## Find Extensions by Task

The recommender is the fastest way to narrow things down.

Try a task like:

```text
I need to create a polished tutorial for WeChat, X, and community forums, with text and visual assets.
```

The hub scores local metadata such as extension names, descriptions, categories, and prompt hints, then suggests likely Plugins or Skills.

Your task text is not uploaded. The recommendation happens locally against scanned metadata.

## Clean Up Duplicates and Warnings

If you install, copy, or build skills often, duplicate names and incomplete metadata are easy to miss.

Common warnings include:

- the same extension name in multiple locations;
- a missing `SKILL.md`;
- incomplete plugin metadata;
- marketplace records that do not match the local cache.

This is useful before sharing a local tool with other people.

## Third-Party Plugin Updates

The hub can record third-party marketplace plugin update checks.

The policy is conservative: eligible third-party marketplace plugins can be checked, while self-built local plugins, `local-plugins`, and managed runtime bundles are skipped.

If you want automation, ask your local agent to follow the README and schedule the update check for 3:00 AM every Sunday. The UI will show the latest update result and per-extension records.

## Who It Helps

Codex Extension Hub is useful if:

- you have many Codex plugins or skills and want to know what is installed;
- your team maintains shared skills and needs a visible local catalog;
- you often work on tutorials, proposals, decks, audits, or code tasks and want to pick the right extension faster.

If you only use one or two extensions, you may not need it yet. Once the list grows, a local dashboard saves a lot of context switching.
