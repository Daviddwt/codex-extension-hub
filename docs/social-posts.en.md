# Social Sharing Kit

## Short Post

I built a local dashboard for Codex extensions.

Once you install enough plugins, skills, MCP servers, and local tools, the hard part becomes remembering:

- what is installed;
- how to invoke it;
- what is global vs project-level;
- which items are duplicated or missing metadata;
- whether third-party plugins have been checked for updates;
- which extension fits the task in front of you.

Codex Extension Hub reads local metadata from installed Plugins, Skills, MCP servers, Apps, and Hooks, then turns it into a searchable web dashboard. It runs locally, does not execute extension scripts, and does not upload your data.

Recommended install style: give the GitHub URL and safety requirements to your local agent, then let the agent read the README, install dependencies, start the dashboard, and verify the page.

```text
Install this local Codex tool for me:
https://github.com/Daviddwt/codex-extension-hub

Please read the safety notes, download the latest version, install dependencies,
open the web dashboard, and verify that it works.
Do not execute discovered Plugin, Skill, Hook, or MCP scripts.
Do not upload local extension data.
```

GitHub:

```text
https://github.com/Daviddwt/codex-extension-hub
```

## Forum Title Ideas

- Codex Extension Hub: a local dashboard for Plugins, Skills, and MCP servers
- Open source: discover and audit your local Codex extensions
- Too many Codex skills? Put them in a local dashboard first

## Forum Summary

Codex Extension Hub is a local web app for discovering, auditing, and reusing Codex extensions. It reads local metadata for Plugins, Skills, MCP servers, Apps/Connectors, and Hooks, then shows source, install scope, invocation names, descriptions, status, configuration warnings, third-party update records, and local task-based recommendations. It does not execute extension scripts, does not start MCP servers, and does not upload local data.
